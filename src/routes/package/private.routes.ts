import { Router } from 'express'

import {
  approvePackage,
  createDraftPackage,
  deletePackage,
  getDraftPackages,
  getEditablePackage,
  getLikedPackages,
  getPackageDetails,
  getPendingPackages,
  getReviewEligibility,
  likePackage,
  postPackage,
  postPackageReview,
  rejectPackage,
  revealPackage,
  submitPackageForApproval,
  unapprovePackage,
  updateDraftPackage,
  updatePackage,
} from '../../controllers/package.controllers'

const privatePackageRoutes = Router()

privatePackageRoutes.get('/my-draft-packages', getDraftPackages)
privatePackageRoutes.get('/pending-packages', getPendingPackages)
privatePackageRoutes.get('/package-details/:id', getPackageDetails)
privatePackageRoutes.get('/edit-package/:id', getEditablePackage)
privatePackageRoutes.post('/draft-package', createDraftPackage)
privatePackageRoutes.post('/post-package', postPackage)
privatePackageRoutes.patch('/draft-package/:id', updateDraftPackage)
privatePackageRoutes.patch('/submit-package/:id', submitPackageForApproval)
privatePackageRoutes.patch('/update-package/:id', updatePackage)
privatePackageRoutes.post('/post-package-review', postPackageReview)
privatePackageRoutes.get('/review-eligibility/:id', getReviewEligibility)
privatePackageRoutes.delete('/delete-package/:id', deletePackage)
privatePackageRoutes.patch('/approve-package/:id', approvePackage)
privatePackageRoutes.patch('/unapprove-package/:id', unapprovePackage)
privatePackageRoutes.patch('/reject-package/:id', rejectPackage)
privatePackageRoutes.patch('/reveal-package/:id', revealPackage)
privatePackageRoutes.get('/get-liked-packages', getLikedPackages)
privatePackageRoutes.post('/like-package/:id', likePackage)

export default privatePackageRoutes
