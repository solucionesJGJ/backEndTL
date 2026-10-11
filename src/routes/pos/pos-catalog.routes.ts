import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { getCategories,getCategoryById,postCategory,putCategory,getItems,getItemById,postItem,putItem } from "../../controllers/pos/pos-catalog.controller.js";
const router=Router();router.use(authMiddleware,requireRole("admin"));
router.get("/categories",getCategories);router.post("/categories",postCategory);router.get("/categories/:id",getCategoryById);router.put("/categories/:id",putCategory);
router.get("/items",getItems);router.post("/items",postItem);router.get("/items/:id",getItemById);router.put("/items/:id",putItem);
export default router;
