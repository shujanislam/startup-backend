import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import type { Response } from 'express'
import logger from '../config/logger'
import User from '../models/User'
import type { AuthenticatedRequest } from '../types/auth'
import { createUserSchema, validateSchema } from '../utils/validSchema'

const sanitizeUser = (user: { [key: string]: unknown }) => {
	const { password: _password, ...safeUser } = user
	return safeUser
}

const registerUser = async (req: AuthenticatedRequest, res: Response) => {
	if (!req.user) {
		return res.status(401).json({ message: 'Unauthorized' })
	}

	const validation = validateSchema(createUserSchema, req.body)

	if (!validation.success) {
		return res.status(400).json({
			message: 'Validation failed',
			errors: validation.errors,
		})
	}

	const { name, email, password, gender } = validation.data

	if (req.user.token.email && req.user.token.email !== email) {
		return res.status(400).json({
			message: 'Email must match authenticated Firebase user email',
		})
	}

	try {
		const existingUser = await User.findOne({
			$or: [{ email }, { firebaseId: req.user.uid }],
		})

		if (existingUser) {
			return res.status(409).json({ message: 'User already exists' })
		}

		const hashedPassword = await bcrypt.hash(password, 10)

		const createdUser = await User.create({
			firebaseId: req.user.uid,
			name,
			email,
			password: hashedPassword,
			gender,
		})

		return res.status(201).json({
			message: 'User registered successfully',
			user: sanitizeUser(createdUser.toObject()),
		})
	} catch (error) {
		logger.error(
			`Error registering user: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)

		return res.status(500).json({ message: 'Failed to register user' })
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
		let user = await User.findOne({ firebaseId: req.user.uid })

		if (!user) {
			const tokenEmail = req.user.token.email || `${req.user.uid}@firebase.local`

			const generatedPassword = crypto.randomBytes(18).toString('hex')
			const hashedPassword = await bcrypt.hash(generatedPassword, 10)
			const fallbackName =
				req.user.token.name || tokenEmail.split('@')[0] || 'user'

			user = await User.create({
				firebaseId: req.user.uid,
				name: fallbackName,
				email: tokenEmail,
				password: hashedPassword,
				gender: 'prefer_not_to_say',
			})
		}

		const safeUser = sanitizeUser(user.toObject())

		return res.status(200).json({
			user: {
				...safeUser,
				uid: user.firebaseId,
				email: user.email,
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
		const existingUser = await User.findOne({ firebaseId: req.user.uid })

		if (existingUser) {
			const safeUser = sanitizeUser(existingUser.toObject())

			return res.status(200).json({
				message: 'User already synced',
				user: {
					...safeUser,
					uid: existingUser.firebaseId,
					email: existingUser.email,
				},
			})
		}

		const tokenEmail = req.user.token.email

		if (!tokenEmail) {
			return res.status(400).json({
				message: 'Unable to sync user without email in Firebase token',
			})
		}

		const generatedPassword = crypto.randomBytes(18).toString('hex')
		const hashedPassword = await bcrypt.hash(generatedPassword, 10)
		const fallbackName =
			req.user.token.name || tokenEmail.split('@')[0] || 'user'

		const createdUser = await User.create({
			firebaseId: req.user.uid,
			name: fallbackName,
			email: tokenEmail,
			password: hashedPassword,
			gender: 'prefer_not_to_say',
		})

		const safeUser = sanitizeUser(createdUser.toObject())

		return res.status(201).json({
			message: 'User synced successfully',
			user: {
				...safeUser,
				uid: createdUser.firebaseId,
				email: createdUser.email,
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
