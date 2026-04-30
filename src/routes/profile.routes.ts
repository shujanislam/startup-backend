import { Router, Request, Response } from 'express';

import { getProfiles, showProfile, updateProfile, deleteProfile, getRevealedPackages } from '../controllers/profile.controllers'

const router: Router = Router();

router.get('/get-profiles', getProfiles);

router.get('/show-profile/:id', showProfile);

router.patch('/update-profile/:id', updateProfile);

router.delete('/delete-profile/:id', deleteProfile);

router.get('/get-revealed-packages', getRevealedPackages)

export default router
