import { Router } from 'express'

import {
  deleteProfile,
  getCreatedPackages,
  getProfiles,
  getRevealedPackages,
  showProfile,
  updateProfile,
} from '../../controllers/profile.controllers'

const privateProfileRoutes = Router()

privateProfileRoutes.get('/get-profiles', getProfiles)
privateProfileRoutes.get('/show-profile/:id', showProfile)
privateProfileRoutes.patch('/update-profile/:id', updateProfile)
privateProfileRoutes.delete('/delete-profile/:id', deleteProfile)
privateProfileRoutes.get('/get-revealed-packages', getRevealedPackages)
privateProfileRoutes.get('/get-created-packages', getCreatedPackages)

export default privateProfileRoutes
