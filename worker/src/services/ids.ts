import { nanoid } from "nanoid";

export const createJobId = () => `job_${nanoid(12)}`;
export const createEventId = () => `evt_${nanoid(12)}`;
export const createOrderCode = () => `2D-${nanoid(6).toUpperCase()}`;
