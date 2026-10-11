import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import {
  getOrganizations,
  getOrganizationById,
  postOrganization,
  putOrganization,
  getLocations,
  getLocationById,
  postLocation,
  putLocation,
} from "../../controllers/pos/pos-config.controller.js";

const router = Router();
router.use(authMiddleware, requireRole("admin"));
router.get("/organizations", getOrganizations);
router.post("/organizations", postOrganization);
router.get("/organizations/:id", getOrganizationById);
router.put("/organizations/:id", putOrganization);
router.get("/locations", getLocations);
router.post("/locations", postLocation);
router.get("/locations/:id", getLocationById);
router.put("/locations/:id", putLocation);
export default router;
