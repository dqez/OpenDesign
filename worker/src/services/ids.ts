import { nanoid } from "nanoid";
import { DEFAULT_ORDER_CODE_PREFIX } from "../config";

export const createJobId = () => `job_${nanoid(12)}`;
export const createEventId = () => `evt_${nanoid(12)}`;
export const createOrderCode = (prefix = DEFAULT_ORDER_CODE_PREFIX) =>
  `${prefix}-${nanoid(6).toUpperCase()}`;
