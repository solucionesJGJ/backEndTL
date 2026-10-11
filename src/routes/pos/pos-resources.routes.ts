import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import {
  getTaxProfiles, getTaxProfileById, postTaxProfile, putTaxProfile,
  getTerminals, getTerminalById, postTerminal, putTerminal,
} from "../../controllers/pos/pos-resources.controller.js";
const router = Router();
router.use(authMiddleware,requireRole("admin"));
router.get("/tax-profiles",getTaxProfiles);
router.post("/tax-profiles",postTaxProfile);
router.get("/tax-profiles/:id",getTaxProfileById);
router.put("/tax-profiles/:id",putTaxProfile);
router.get("/terminals",getTerminals);
router.post("/terminals",postTerminal);
router.get("/terminals/:id",getTerminalById);
router.put("/terminals/:id",putTerminal);
export default router;
