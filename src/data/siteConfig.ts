import archiveDataRaw from './archive_data.json'
import type { ArchiveData, HomepageConfig, SiteLayoutConfig, SiteUiConfig } from '../types'

const archiveData = archiveDataRaw as ArchiveData

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
  texts_default_section_key: 'headline',
}

const defaultHomepage: HomepageConfig = {
  games: [],
  visions: [],
  music: [],
  texts: [],
}

export const siteUi: SiteUiConfig = {
  ...defaultSiteUi,
  ...(archiveData.metadata.site_ui ?? {}),
}

export const siteLayout: SiteLayoutConfig = {
  ...defaultSiteLayout,
  ...(archiveData.metadata.site_layout ?? {}),
  games_season_priority: {
    ...defaultSiteLayout.games_season_priority,
    ...(archiveData.metadata.site_layout?.games_season_priority ?? {}),
  },
}

export const homepageConfig: HomepageConfig = {
  ...defaultHomepage,
  ...(archiveData.metadata.homepage ?? {}),
}
