import fs from 'node:fs'
import path from 'node:path'
import admin from 'firebase-admin'

const configuredServiceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  'startup-2c9aa-firebase-adminsdk-fbsvc-cf6f727bcd.json'

const serviceAccountPath = path.isAbsolute(configuredServiceAccountPath)
  ? configuredServiceAccountPath
  : path.resolve(process.cwd(), configuredServiceAccountPath)

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(
    `Firebase service account file not found at: ${serviceAccountPath}`,
  )
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf-8'),
) as admin.ServiceAccount

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

export { admin }