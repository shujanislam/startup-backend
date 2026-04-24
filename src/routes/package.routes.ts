import { Router, Request, Response } from 'express';

import { getPackages, viewPackage, postPackage, deletePackage } from '../controllers/package.controllers'

const router: Router = Router();

router.get('/get-packages', getPackages);

router.get('/view-package', viewPackage);

router.get('/post-package', postPackage);

router.get('/delete-package', deletePackage);

export default router
