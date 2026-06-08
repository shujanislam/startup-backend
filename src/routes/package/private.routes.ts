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
  unlikePackage,
  updateDraftPackage,
  updatePackage,
  viewPackage,
} from '../../controllers/package.controllers'

import { uploadCoverImage, uploadHotelPhoto } from '../../controllers/uploadController'
import { handleMulterError } from '../../middleware/uploadHandler'
import uploadPackageCoverImage from '../../utils/uploadPackageCoverImage'
import uploadHotelPhotoMulter from '../../utils/uploadHotelPhoto'

const privatePackageRoutes = Router()

// Image upload endpoint
privatePackageRoutes.post(
  '/upload-cover-image',
  (req, res, next) => {
    uploadPackageCoverImage.single('coverImage')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next)
      }
      next()
    })
  },
  uploadCoverImage
)

privatePackageRoutes.post(
  '/upload-hotel-photo',
  (req, res, next) => {
    uploadHotelPhotoMulter.single('hotelPhoto')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next)
      }
      next()
    })
  },
  uploadHotelPhoto
)

// Package management endpoints
privatePackageRoutes.get('/my-draft-packages', getDraftPackages)
privatePackageRoutes.get('/pending-packages', getPendingPackages)
privatePackageRoutes.get('/view-package/:id', viewPackage)
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
privatePackageRoutes.delete('/unlike-package/:id', unlikePackage)

export default privatePackageRoutes
