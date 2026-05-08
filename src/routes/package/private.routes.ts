import { Router } from 'express'

import {
  approvePackage,
  deletePackage,
  getLikedPackages,
  getPendingPackages,
  getReviewEligibility,
  likePackage,
  postPackage,
  postPackageReview,
  revealPackage,
  unapprovePackage,
  updatePackage,
} from '../../controllers/package.controllers'

const privatePackageRoutes = Router()

privatePackageRoutes.get('/pending-packages', getPendingPackages)
privatePackageRoutes.post('/post-package', postPackage)
privatePackageRoutes.patch('/update-package/:id', updatePackage)
privatePackageRoutes.post('/post-package-review', postPackageReview)
privatePackageRoutes.get('/review-eligibility/:id', getReviewEligibility)
privatePackageRoutes.delete('/delete-package/:id', deletePackage)
privatePackageRoutes.patch('/approve-package/:id', approvePackage)
privatePackageRoutes.patch('/unapprove-package/:id', unapprovePackage)
privatePackageRoutes.patch('/reveal-package/:id', revealPackage)
privatePackageRoutes.get('/get-liked-packages', getLikedPackages)
privatePackageRoutes.post('/like-package/:id', likePackage)

export default privatePackageRoutes
