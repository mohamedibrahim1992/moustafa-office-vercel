import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import invoicesRouter from "./invoices";
import expensesRouter from "./expenses";
import reportsRouter from "./reports";
import commandsRouter from "./commands";
import declarationsRouter from "./declarations";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth, clientsRouter);
router.use(requireAuth, invoicesRouter);
router.use(requireAuth, expensesRouter);
router.use(requireAuth, reportsRouter);
router.use(requireAuth, commandsRouter);
router.use(requireAuth, declarationsRouter);

export default router;
