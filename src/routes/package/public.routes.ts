import { Router } from 'express'

import {
  discoverPackage,
  getPackageReviews,
  getPackages,
  getFeaturedPackage,
} from '../../controllers/package.controllers'

const publicPackageRoutes = Router()

publicPackageRoutes.get('/get-packages', getPackages)
publicPackageRoutes.get('/get-featured-package', getFeaturedPackage)
publicPackageRoutes.get('/discover-package', discoverPackage)
publicPackageRoutes.get('/get-package-reviews/:id', getPackageReviews)

export default publicPackageRoutes
