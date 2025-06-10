import { ActivityType, Assets, getTimestamps, timestampFromFormat } from 'premid'

const presence = new Presence({
  clientId: '463151177836658699',
})

enum ActivityAssets {
  Logo = 'https://cdn.rcd.gg/PreMiD/websites/Y/YouTube%20Music/assets/logo.png',
  SmallLogo = `https://cdn.rcd.gg/PreMiD/websites/Y/YouTube%20Music/assets/0.png`,
}

let prevTitleAuthor = ''
let presenceData: PresenceData
let mediaTimestamps: [number, number]
let oldPath: string
let startTimestamp: number
let videoListenerAttached = false
let useTimeLeftChanged = false

presence.on('UpdateData', async () => {
  const { pathname, search, href } = document.location
  const [
    showButtons,
    showTimestamps,
    showCover,
    hidePaused,
    showBrowsing,
    privacyMode,
    useTimeLeft,
    showAsListening,
    artistAsTitle,
  ] = await Promise.all([
    presence.getSetting<boolean>('buttons'),
    presence.getSetting<boolean>('timestamps'),
    presence.getSetting<boolean>('cover'),
    presence.getSetting<boolean>('hidePaused'),
    presence.getSetting<boolean>('browsing'),
    presence.getSetting<boolean>('privacy'),
    presence.getSetting<boolean>('useTimeLeft'),
    presence.getSetting<boolean>('showAsListening'),
    presence.getSetting<boolean>('artistAsTitle'),
  ])
  const { mediaSession } = navigator
  const watchID = href.match(/v=([^&#]{5,})/)?.[1]
    ?? document
      .querySelector<HTMLAnchorElement>('a.ytp-title-link.yt-uix-sessionlink')
      ?.href
      .match(/v=([^&#]{5,})/)?.[1]
  const repeatMode = document
    .querySelector('ytmusic-player-bar[slot="player-bar"]')
    ?.getAttribute('repeat-mode')
  const videoElement = document.querySelector<HTMLMediaElement>('.video-stream')

  if (useTimeLeftChanged !== useTimeLeft && !privacyMode) {
    useTimeLeftChanged = useTimeLeft
    updateSongTimestamps(useTimeLeft)
  }

  if (videoElement && !privacyMode) {
    if (!videoListenerAttached) {
      videoElement.addEventListener('seeked', () =>
        updateSongTimestamps(useTimeLeft))
      videoElement.addEventListener('play', () =>
        updateSongTimestamps(useTimeLeft))

      videoListenerAttached = true
    }
  }
  else {
    prevTitleAuthor = ''
    videoListenerAttached = false
  }

  presenceData = {}

  if (hidePaused && mediaSession?.playbackState !== 'playing')
    return presence.clearActivity()

  if (['playing', 'paused'].includes(mediaSession?.playbackState)) {
    if (privacyMode) {
      return presence.setActivity({
        type: ActivityType.Listening,
        largeImageKey: ActivityAssets.Logo,
      })
    }

    if (!mediaSession?.metadata?.title || Number.isNaN(videoElement?.duration ?? Number.NaN))
      return

    if (
      prevTitleAuthor
      !== mediaSession.metadata.title
      + mediaSession.metadata.artist
      + document
        .querySelector<HTMLSpanElement>('#left-controls > span')
        ?.textContent
        ?.trim()
    ) {
      updateSongTimestamps(useTimeLeft)

      if (mediaTimestamps[0] === mediaTimestamps[1])
        return

      prevTitleAuthor = mediaSession.metadata.title
        + mediaSession.metadata.artist
        + document
          .querySelector<HTMLSpanElement>('#left-controls > span')
          ?.textContent
          ?.trim()
    }

    const albumArtistBtnLink = mediaSession?.metadata?.album
      ? [...document.querySelectorAll<HTMLAnchorElement>('.byline a')]?.at(-1)?.href
      : document.querySelector<HTMLAnchorElement>('.byline a')?.href
    const buttons: [ButtonData, ButtonData?] = [
      {
        label: 'Listen Along',
        url: `https://music.youtube.com/watch?v=${watchID}`,
      },
    ]

    if (albumArtistBtnLink) {
      buttons.push({
        label: `View ${mediaSession.metadata.album ? 'Album' : 'Artist'}`,
        url: albumArtistBtnLink,
      })
    }

    presenceData = {
      type: ActivityType.Listening,
      // 변경: 항상 노래 제목을 메인 타이틀로 표시
      name: mediaSession.metadata.title,
      // 상세 정보에는 아티스트 이름 표시
      details: mediaSession.metadata.artist,
      largeImageKey: showCover
        ? mediaSession?.metadata?.artwork?.at(-1)?.src
        ?? ActivityAssets.Logo
        : ActivityAssets.Logo,
      state: mediaSession.metadata.album || undefined,
      ...(showButtons && { buttons }),
      ...(mediaSession.playbackState === 'paused' || (repeatMode && repeatMode !== 'NONE')
        ? {
            smallImageKey: mediaSession.playbackState === 'paused'
              ? Assets.Pause
              : repeatMode === 'ONE'
                ? Assets.RepeatOne
                : Assets.Repeat,
            smallImageText: mediaSession.playbackState === 'paused'
              ? 'Paused'
              : repeatMode === 'ONE'
                ? 'On loop'
                : 'Playlist on loop',
          }
        : null),
      ...(showTimestamps && mediaSession.playbackState === 'playing' && {
        startTimestamp: mediaTimestamps[0],
        endTimestamp: mediaTimestamps[1],
      }),
    }
  }
  else if (showBrowsing) {
    if (privacyMode) {
      return presence.setActivity({
        largeImageKey: ActivityAssets.Logo,
        details: 'Browsing YouTube Music',
      })
    }

    if (oldPath !== pathname) {
      oldPath = pathname
      startTimestamp = Math.floor(Date.now() / 1000)
    }

    presenceData = {
      type: ActivityType.Playing,
      largeImageKey: ActivityAssets.Logo,
      details: 'Browsing',
      startTimestamp,
    }

    // ... browsing 로직 유지
  }

  presence.setActivity(presenceData)
})

function updateSongTimestamps(useTimeLeft: boolean) {
  const [currTimes, totalTimes] = document
    .querySelector<HTMLSpanElement>('#left-controls > span')
    ?.textContent
    ?.trim()
    ?.split(' / ') ?? []

  if (useTimeLeft && currTimes && totalTimes) {
    mediaTimestamps = getTimestamps(
      timestampFromFormat(currTimes),
      timestampFromFormat(totalTimes),
    )
  }
  else if (currTimes) {
    mediaTimestamps = [
      Date.now() / 1000 - timestampFromFormat(currTimes),
      0,
    ]
  }
}
