import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { HydratedDocument } from 'mongoose'
import User, { type IUser } from '../models/User'

const getTokenEmail = (token: DecodedIdToken) => token.email?.trim().toLowerCase()

const getFallbackName = (token: DecodedIdToken, email: string) =>
  token.name || email.split('@')[0] || 'user'

export const ensureUserForFirebaseToken = async (
  firebaseUid: string,
  token: DecodedIdToken,
): Promise<HydratedDocument<IUser>> => {
  const tokenEmail = getTokenEmail(token)
  const userLookup = tokenEmail
    ? { $or: [{ firebaseId: firebaseUid }, { email: tokenEmail }] }
    : { firebaseId: firebaseUid }

  let user = await User.findOne(userLookup)

  if (user) {
    if (user.firebaseId !== firebaseUid) {
      user.firebaseId = firebaseUid
      await user.save()
    }

    return user
  }

  const email = tokenEmail || `${firebaseUid}@firebase.local`
  const generatedPassword = crypto.randomBytes(18).toString('hex')
  const hashedPassword = await bcrypt.hash(generatedPassword, 10)

  return User.create({
    firebaseId: firebaseUid,
    name: getFallbackName(token, email),
    email,
    password: hashedPassword,
    gender: 'prefer_not_to_say',
  })
}
