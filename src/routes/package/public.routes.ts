import { Router } from 'express'

import {
  discoverPackage,
  getPackageReviews,
  getPackages,
  viewPackage,
} from '../../controllers/package.controllers'

const publicPackageRoutes = Router()

publicPackageRoutes.get('/get-packages', getPackages)
publicPackageRoutes.get('/view-package/:id', viewPackage)
publicPackageRoutes.get('/discover-package', discoverPackage)
publicPackageRoutes.get('/get-package-reviews/:id', getPackageReviews)

export default publicPackageRoutes
