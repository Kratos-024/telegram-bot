import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";

const checkCorn = asyncHandler(async (req: Request, res: Response) => {
  try {
    res.status(200).send(new ApiResponse(200, "Successfully make the request"));
  } catch (error) {
    res
      .status(400)
      .send(new ApiResponse(400, "Something went wrong with request"));
  }
});
export default checkCorn;
