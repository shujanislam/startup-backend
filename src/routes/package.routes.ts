import { Router, Request, Response } from 'express';

import {
  getPackages,
  viewPackage,
  discoverPackage,
  getPendingPackages,
  postPackage,
  updatePackage,
  postPackageReview,
  deletePackage,
  approvePackage,
  unapprovePackage,
  revealPackage,
} from '../controllers/package.controllers'

const router: Router = Router();

router.get('/get-packages', getPackages);

router.get('/view-package/:id', viewPackage);

router.get('/discover-package', discoverPackage)
router.get('/pending-packages', getPendingPackages)

router.post('/post-package', postPackage);

router.patch('/update-package/:id', updatePackage);

router.post('/post-package-review', postPackageReview);

router.delete('/delete-package/:id', deletePackage);

router.patch('/approve-package/:id', approvePackage);
router.patch('/unapprove-package/:id', unapprovePackage);

router.patch('/reveal-package/:id', revealPackage);

export default router
