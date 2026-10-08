import { Router, type IRouter } from "express";
import healthRouter from "./health";
import supportflowRouter from "./supportflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(supportflowRouter);

export default router;
