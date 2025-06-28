import Router from "express";
import checkCorn from "../controllers/corn.controller";

const cornRouter = Router();

cornRouter.route("/get").get(checkCorn);
export default cornRouter;
