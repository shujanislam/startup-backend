import { Router, Request, Response } from 'express';

import { getPackages, viewPackage, discoverPackage, postPackage, updatePackage, postPackageReview, deletePackage, approvePackage } from '../controllers/package.controllers'

const router: Router = Router();

router.get('/get-packages', getPackages);

router.get('/view-package/:id', viewPackage);

router.get('/discover-package', discoverPackage)

router.post('/post-package', postPackage);

router.patch('/update-package/:id', updatePackage);

router.post('/post-package-review', postPackageReview);

router.delete('/delete-package/:id', deletePackage);

router.post('/approve-package', approvePackage);

export default router
