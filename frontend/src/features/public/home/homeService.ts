import { withMockDelay } from "../../../utils/mockDelay";
import { careerArticles, featuredHomeCompanies, featuredHomeJobs, featuredIndustries, homeStatistics } from "./homeMockData";
import type { HomeData } from "./homeTypes";

export function getHomeData() {
  const data: HomeData = {
    statistics: homeStatistics,
    jobs: featuredHomeJobs,
    industries: featuredIndustries,
    companies: featuredHomeCompanies,
    articles: careerArticles,
  };

  return withMockDelay(data);
}
