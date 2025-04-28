import { Router } from "express";
import AuthorityAccountController from "../controllers/authorityAccountController";
import multer, { memoryStorage } from "multer";
import { isAuthenticated } from "../middleware/authenticationMiddleware";

const upload = multer({ storage: memoryStorage() });

const router = Router();

router.use(isAuthenticated);

router.post("/authorityAdd", upload.single("image"), AuthorityAccountController.addAuthorityUser);

router.put("/updateAuthorityUser/:id", upload.single("image"), AuthorityAccountController.updateAuthorityUser);

router.get("/getAuthorityUserData/:id", AuthorityAccountController.getUserData);

router.get("/getAuthorityUserDocuments/:id", AuthorityAccountController.getUserDocs);

router.get("/viewDocument/:fileName", AuthorityAccountController.viewDocument); 

export default router;