import { Router, Request, Response } from 'express';

import { getProfiles, showProfile, updateProfile, deleteProfile } from '../controllers/profile.controllers'

const router: Router = Router();

router.get('/get-profiles', getProfiles);

router.get('/show-profile/:id', showProfile);

router.get('/update-profile/:id', updateProfile);

router.get('/delete-profile/:id', deleteProfile);

export default router
