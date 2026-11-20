// cr-video-captions: video and audio need a manual check for captions, audio description and
// transcripts (WCAG 1.2.1–1.2.5).
function crVideoCaptions() {
  const PLAYERS =
    /youtube(-nocookie)?\.com|youtu\.be|player\.vimeo\.com|jwplayer|jwplatform|wistia|brightcove|dailymotion|facebook\.com\/plugins\/video|vidyard|kaltura/i;
  const findings = [];
  for (const video of document.querySelectorAll("video")) {
    const hasTrack =
      video.querySelector("track[kind='captions'], track[kind='subtitles']") !== null;
    findings.push(
      a11yFinding(
        video,
        hasTrack
          ? "Video with a captions track: check the captions are accurate and complete, and that audio description or a transcript covers important visual information."
          : "Video without a captions track: if it has speech or important sounds it needs captions, and important visual information needs audio description or a transcript.",
      ),
    );
  }
  for (const audio of document.querySelectorAll("audio")) {
    findings.push(a11yFinding(audio, "Audio player: check a transcript is provided."));
  }
  for (const frame of document.querySelectorAll("iframe[src]")) {
    if (!PLAYERS.test(frame.getAttribute("src"))) continue;
    findings.push(
      a11yFinding(
        frame,
        "Embedded video player: check the video has accurate captions, and audio description or a transcript.",
      ),
    );
  }
  return findings.slice(0, 50);
}
