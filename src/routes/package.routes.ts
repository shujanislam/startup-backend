import { Router, Request, Response } from 'express';

import { getPackages, viewPackage, postPackage, updatePackage, postPackageReview, deletePackage } from '../controllers/package.controllers'

const router: Router = Router();

router.get('/get-packages', getPackages);

router.get('/view-package/:id', viewPackage);

router.post('/post-package', postPackage);

router.patch('/update-package/:id', updatePackage);

router.post('/post-package-review', postPackageReview);

router.delete('/delete-package/:id', deletePackage);

export default router
