import { Router, Request, Response } from 'express';

import { getPackages, viewPackage, postPackage, postPackageReview, deletePackage } from '../controllers/package.controllers'

const router: Router = Router();

router.get('/get-packages', getPackages);

router.get('/view-package', viewPackage);

router.post('/post-package', postPackage);

router.post('/post-package-review', postPackageReview);

router.delete('/delete-package/:id', deletePackage);

export default router
