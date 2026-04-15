import siteConfigRaw from './site_config.json'
import type { HomepageConfig, SiteConfigData, SiteLayoutConfig, SiteUiConfig } from '../types'

const siteConfig = siteConfigRaw as SiteConfigData
const generatedAt = siteConfig.generated_at || ''

const defaultSiteUi: SiteUiConfig = {
  current_album: 'Current Album',
  selected_section: 'Selected Section',
  unclassified: '未分类',
  unknown: '未知',
  unrated: '未评分',
  season_journey: '赛季旅程',
  season_special: 'SEASON / 赛季专区',
}

const defaultSiteLayout: SiteLayoutConfig = {
  home_latest_games_count: 9,
  home_latest_visions_count: 9,
  home_latest_music_count: 7,
  home_latest_texts_count: 4,
  games_season_target_year: 2026,
  games_season_priority: {
    英雄联盟: 0,
    云顶之弈: 1,
    '暗黑破坏神 IV': 2,
  },
  texts_default_section_key: 'book-reviews',
}

const defaultHomepage: HomepageConfig = {
  games: [],
  visions: [],
  music: [],
  texts: [],
}

export const siteUi: SiteUiConfig = {
  ...defaultSiteUi,
  ...(siteConfig.site_ui ?? {}),
}

export const siteLayout: SiteLayoutConfig = {
  ...defaultSiteLayout,
  ...(siteConfig.site_layout ?? {}),
  games_season_priority: {
    ...defaultSiteLayout.games_season_priority,
    ...(siteConfig.site_layout?.games_season_priority ?? {}),
  },
}

export const homepageConfig: HomepageConfig = {
  ...defaultHomepage,
  ...(siteConfig.homepage ?? {}),
}

export const assetVersion = generatedAt
