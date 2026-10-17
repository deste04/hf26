"use server";
import { isGithubLogin } from "../../lib/query";
import { contributionCalendar } from "../github";

/** One year of the contribution calendar, or the last year when `year` is null (the calendar's year switch). */
export async function getContributionCalendar(login: string, year: number | null) {
  if (!isGithubLogin(login)) return null;
  try {
    return await contributionCalendar(login, year ?? undefined);
  } catch {
    return null;
  }
}
