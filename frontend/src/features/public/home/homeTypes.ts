import type { ReactNode } from "react";

export interface HomeStatistic {
  id: string;
  label: string;
  value: string;
}

export interface FeaturedHomeJob {
  id: string;
  logo: string;
  title: string;
  companyName: string;
  salary: string;
  location: string;
  workMode: string;
  skills: string[];
  deadline: string;
  featuredLabel: string;
}

export interface FeaturedIndustry {
  id: string;
  name: string;
  jobCount: number;
  iconName: "code" | "briefcase" | "megaphone" | "banknote" | "calculator" | "users" | "palette" | "chart";
}

export interface FeaturedHomeCompany {
  id: string;
  logo: string;
  name: string;
  industry: string;
  size: string;
  location: string;
  openJobs: number;
  verified: boolean;
}

export interface CareerArticle {
  id: string;
  title: string;
  summary: string;
  path: string;
}

export interface HomeData {
  statistics: HomeStatistic[];
  jobs: FeaturedHomeJob[];
  industries: FeaturedIndustry[];
  companies: FeaturedHomeCompany[];
  articles: CareerArticle[];
}

export type IndustryIconMap = Record<FeaturedIndustry["iconName"], ReactNode>;
