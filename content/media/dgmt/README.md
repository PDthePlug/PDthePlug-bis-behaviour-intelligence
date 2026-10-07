# DGMT demonstration narration

The 90-second AAC recording reads the approved paragraphs in `lib/experience/dgmt-demonstration.mjs`. Five 18-second scenes match the video; fifteen WebVTT cues follow the spoken paragraphs. The voice pronounces BIS as its initials. No participant records or private correspondence were used.

Generated locally with Piper and the Alba medium British English voice. Alba is derived from the University of Edinburgh CSTR VCTK Corpus, distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Dataset: [VCTK](https://datashare.ed.ac.uk/handle/10283/3270). Voice model: [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/alba/medium). The recording is time fitted and normalised to -16 LUFS with a -1.5 dB true peak limit. This attribution accompanies the recording.

Use `node scripts/create-dgmt-demonstration.mjs` to rebuild the public MP4 with this recording. If the approved wording changes, update the recording and caption cues together before rebuilding. The generator requires these assets and cannot silently recreate a silent video.
