import axios from "axios";
import { env } from "./config.js";

export const api = axios.create({
  baseURL: "https://uzpharminfo.uz",
  headers: { Cookie: env.COOKIE },
});