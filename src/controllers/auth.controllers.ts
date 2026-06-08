import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import { admin } from '../config/firebaseAdmin'
import logger from '../config/logger'
import User from '../models/User'
import { ensureUserForFirebaseToken } from '../services/auth.service'
import type { AuthenticatedRequest } from '../types/auth'
import { createUserSchema, validateSchema } from '../utils/validSchema'
import { checkAdminRole } from '../utils/roleCheck'

const sanitizeUser = <T extends { password?: unknown }>(user: T) => {
	const { password: _password, ...safeUser } = user
	return safeUser
}

const logAdminLogin = async (
	user: { _id: { toString: () => string }; email: string; firebaseId: string },
	source: 'email-password' | 'firebase-sync',
) => {
	const roleCheck = await checkAdminRole(user._id.toString())
	const isAdmin = roleCheck.ok

	if (!isAdmin) {
		return false
	}

	logger.info(`Admin logged in via ${source}: email=${user.email}, firebaseId=${user.firebaseId}`)
	return true
}

const registerUser = async (req: Request, res: Response) => {
	const validation = validateSchema(createUserSchema, req.body)

	if (!validation.success) {
		return res.status(400).json({
			message: 'Validation failed',
			errors: validation.errors,
		})
	}

	const { name, email, password, gender } = validation.data

	let firebaseUid: string
	let createdFirebaseUser = false

	try {
		// Step 1: Create Firebase user (or reuse existing from a previous partial attempt)
		try {
			const firebaseUser = await admin.auth().createUser({
				email,
				password,
				displayName: name,
			})
			firebaseUid = firebaseUser.uid
			createdFirebaseUser = true
		} catch (firebaseError: unknown) {
			const code = (firebaseError as { code?: string }).code

			if (code === 'auth/email-already-exists') {
				// Reuse existing Firebase user from a previous failed attempt
				const existingFirebaseUser = await admin.auth().getUserByEmail(email)
				firebaseUid = existingFirebaseUser.uid
				createdFirebaseUser = false
			} else {
				// Ambiguous or transient error — re-check Firebase before giving up
				try {
					const existingFirebaseUser = await admin.auth().getUserByEmail(email)
					firebaseUid = existingFirebaseUser.uid
					createdFirebaseUser = false
				} catch {
					throw firebaseError
				}
			}
		}

		// Step 2: Check if MongoDB user already exists (idempotent)
		const existingMongoUser = await User.findOne({
			$or: [{ email }, { firebaseId: firebaseUid }],
		})

		if (existingMongoUser) {
			const customToken = await admin.auth().createCustomToken(firebaseUid)

			return res.status(200).json({
				message: 'User already registered',
				user: sanitizeUser(existingMongoUser.toObject()),
				customToken,
			})
		}

		// Step 3: Create MongoDB user
		const hashedPassword = await bcrypt.hash(password, 10)

		try {
			const createdUser = await User.create({
				firebaseId: firebaseUid,
				name,
				email,
				password: hashedPassword,
				gender,
			})

			const customToken = await admin.auth().createCustomToken(firebaseUid)

			return res.status(201).json({
				message: 'User registered successfully',
				user: sanitizeUser(createdUser.toObject()),
				customToken,
			})
		} catch (mongoError) {
			// Compensating: remove partial MongoDB record best-effort
			await User.deleteOne({ firebaseId: firebaseUid }).catch(() => {})

			// Compensating: delete Firebase user only if this request created it
			if (createdFirebaseUser) {
				await admin.auth().deleteUser(firebaseUid).catch(() => {})
			}

			throw mongoError
		}
	} catch (error) {
		logger.error(
			`Error registering user: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)

		return res.status(500).json({ message: 'Failed to register user. Please try again.' })
	}
}

const loginUser = async (req: AuthenticatedRequest, res: Response) => {
	if (!req.user) {
		return res.status(401).json({ message: 'Unauthorized' })
	}

	const validation = validateSchema(createUserSchema.pick({ email: true, password: true }), req.body)

	if (!validation.success) {
		return res.status(400).json({
			message: 'Validation failed',
			errors: validation.errors,
		})
	}

	const { email, password } = validation.data

	if (req.user.token.email && req.user.token.email !== email) {
		return res.status(400).json({
			message: 'Email must match authenticated Firebase user email',
		})
	}

	try {
		const user = await User.findOne({
			$or: [{ firebaseId: req.user.uid }, { email }],
		})

		if (!user) {
			return res.status(404).json({ message: 'User not found in database' })
		}

		const isPasswordValid = await bcrypt.compare(password, user.password)

		if (!isPasswordValid) {
			return res.status(401).json({ message: 'Invalid password' })
		}

		await logAdminLogin(user, 'email-password')

		return res.status(200).json({
			message: 'User authenticated successfully',
			user: sanitizeUser(user.toObject()),
		})
	} catch (error) {
		logger.error(
			`Error logging in user: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)

		return res.status(500).json({ message: 'Failed to login user' })
	}
}

const getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
	if (!req.user) {
		return res.status(401).json({ message: 'Unauthorized' })
	}

	try {
		const user = await ensureUserForFirebaseToken(req.user.uid, req.user.token)
		const safeUser = sanitizeUser(user.toObject())
		const roleCheck = await checkAdminRole(user._id.toString())
		const isAdmin = roleCheck.ok

		return res.status(200).json({
			user: {
				...safeUser,
				uid: user.firebaseId,
				email: user.email,
				isAdmin,
			},
		})
	} catch (error) {
		logger.error(
			`Error loading current user: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)

		return res.status(500).json({ message: 'Failed to load user' })
	}
}

const syncFirebaseUser = async (req: AuthenticatedRequest, res: Response) => {
	if (!req.user) {
		return res.status(401).json({ message: 'Unauthorized' })
	}

	try {
		const user = await ensureUserForFirebaseToken(req.user.uid, req.user.token)
		const safeUser = sanitizeUser(user.toObject())
		const roleCheck = await checkAdminRole(user._id.toString())
		const isAdmin = roleCheck.ok
		await logAdminLogin(user, 'firebase-sync')

		return res.status(200).json({
			message: 'User synced successfully',
			user: {
				...safeUser,
				uid: user.firebaseId,
				email: user.email,
				isAdmin,
			},
		})
	} catch (error) {
		logger.error(
			`Error syncing Firebase user: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)

		return res.status(500).json({ message: 'Failed to sync Firebase user' })
	}
}

export { getCurrentUser, loginUser, registerUser, syncFirebaseUser }
