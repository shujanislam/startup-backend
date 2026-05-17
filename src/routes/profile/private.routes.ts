import { Router } from 'express'

import {
  deleteProfile,
  getCreatedPackages,
  getProfiles,
  getRevealedPackages,
  showProfile,
  updateProfile,
} from '../../controllers/profile.controllers'

import uploadProfileImage from '../../utils/uploadProfileImage'

const privateProfileRoutes = Router()

// Profile management endpoints - PATCH now handles both image upload and profile update
privateProfileRoutes.get('/get-profiles', getProfiles)
privateProfileRoutes.get('/show-profile/:id', showProfile)
privateProfileRoutes.patch('/update-profile/:id', uploadProfileImage.single('profilePicture'), updateProfile)
privateProfileRoutes.delete('/delete-profile/:id', deleteProfile)
privateProfileRoutes.get('/get-revealed-packages', getRevealedPackages)
privateProfileRoutes.get('/get-created-packages', getCreatedPackages)

export default privateProfileRoutes
