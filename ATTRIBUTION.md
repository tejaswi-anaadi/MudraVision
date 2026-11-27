# Image Attribution

The mudra reference photographs in `images/` come from two sources, both freely
licensed. If you redistribute Mudra Vision, please keep this attribution file
and the licence terms below.

## 1. Jisha Raj R — Bharatanatyam Mudra Dataset

Files: every `images/*.jpg` (46 "parchment plates"), and the original dataset
photographs kept as pose-source images in `poses/src/*.png`.

- Source: <https://github.com/jisharajr/Bharatanatyam-Mudra-Dataset>
- Author: Jisha Raj R (Ph.D. work under Dr. Sunil T.T, College of Engineering,
  Attingal, Kerala, India)
- Licence: **Creative Commons Attribution-ShareAlike 4.0** (CC BY-SA 4.0)
  <https://creativecommons.org/licenses/by-sa/4.0/>

### Parchment plates (`images/*.jpg`)

Each plate is a real photograph of a trained dancer's hands from the dataset.
One frame per mudra was selected by hand; the frames are listed below.

Changes made: the green screen was removed (saturation/hue keying, with green
spill suppressed and a skin-tone correction for the screen's colour cast), the
forearms were faded out where they leave the frame, and the hands were placed
on a generated parchment texture with a soft shadow and a thin border; resized
to 800 px wide and saved as JPEG. Reproduce with `tools/build_plates.py`.
**No generated imagery is used for the hands** — every hand pixel is the
original photograph.

| Output | Source frame in the dataset |
|---|---|
| `alapadma.jpg` | `Alapadmam(1)/Alapadmam_389.jpg` |
| `anjali.jpg` | `Anjali(1)/Anjali_258.jpg` |
| `arala.jpg` | `Aralam(1)/Aralam_264.jpg` |
| `ardhachandra.jpg` | `Ardhachandran(1)/Ardhachandran_348.jpg` |
| `ardhapataka.jpg` | `Ardhapathaka(1)/Ardhapathaka_254.jpg` |
| `bherunda.jpg` | `Berunda(1)/Berunda  _4.jpg` |
| `bhramara.jpg` | dataset's representative photo (kept in `poses/src/`), cut the same way — *see note* |
| `chakra.jpg` | `Chakra(1)/Chakra _327.jpg` |
| `chandrakala.jpg` | `Chandrakala(1)/Chandrakala_35.jpg` |
| `chatura.jpg` | `Chaturam(1)/Chaturam_35.jpg` |
| `garuda.jpg` | `Garuda(1)/Garuda  _269.jpg` |
| `hamsapaksha.jpg` | `Hamsapaksha(1)/Hamsapaksha_405.jpg` |
| `hamsasya.jpg` | `Hamsasyam(1)/Hamsasyam_403.jpg` |
| `kangula.jpg` | dataset's representative photo (kept in `poses/src/`), cut the same way — *see note* |
| `kapittha.jpg` | `Kapith(1)/Kapith_249.jpg` |
| `kapota.jpg` | `Kapotham(1)/Kapotham_279.jpg` |
| `karkata.jpg` | `Karkatta(1)/Karkatta _247.jpg` |
| `kartarimukha.jpg` | `Katrimukha(1)/Katrimukha_250.jpg` |
| `kartariswastika.jpg` | `Kartariswastika(1)/Kartariswastika _149.jpg` |
| `katakamukha.jpg` | dataset's representative photo (kept in `poses/src/`), cut the same way — *see note* |
| `katakavardhana.jpg` | `Katakavardhana(1)/Katakavardhana _617.jpg` |
| `khatva.jpg` | `Khatva(1)/Khatva  _341.jpg` |
| `kilaka.jpg` | `Kilaka(1)/Kilaka  _27.jpg` |
| `kurma.jpg` | `Kurma(1)/Kurma  _414.jpg` |
| `matsya.jpg` | `Matsya(1)/Matsya  _446.jpg` |
| `mayura.jpg` | `Mayura(1)/Mayura_242.jpg` |
| `mrigashirsha.jpg` | `Mrigasirsha(1)/Mrigasirsha_40.jpg` |
| `mukula.jpg` | `Mukulam(1)/Mukulam_252.jpg` |
| `mushti.jpg` | `Mushti(1)/Mushti_363.jpg` |
| `nagabandha.jpg` | `Nagabandha(1)/Nagabandha  _141.jpg` |
| `padmakosha.jpg` | `Padmakosha(1)/Padmakosha_366.jpg` |
| `pasha.jpg` | `Pasha(1)/Pasha  _364.jpg` |
| `pataka.jpg` | `Pathaka(1)/Pathaka_251.jpg` |
| `pushpaputa.jpg` | `Pushpaputa(1)/Pushpaputa _587.jpg` |
| `samputa.jpg` | `Samputa(1)/Samputa  _341.jpg` |
| `sarpasirsha.jpg` | `Sarpasirsha(1)/Sarpasirsha_25.jpg` |
| `shakata.jpg` | `Sakata(1)/Sakata _420.jpg` |
| `shankha.jpg` | `Shanka(1)/Shanka _588.jpg` |
| `shikhara.jpg` | `Sikharam(1)/Sikharam_385.jpg` |
| `shukatunda.jpg` | `Shukatundam(1)/Shukatundam_40.jpg` |
| `simhamukha.jpg` | `Simhamukham(1)/Simhamukham_239.jpg` |
| `suchi.jpg` | `Suchi(1)/Suchi_229.jpg` |
| `swastika.jpg` | `Swastikam(1)/Swastika​m _3.jpg` |
| `tamrachuda.jpg` | `Tamarachudam(1)/Tamarachudam_40.jpg` |
| `tripataka.jpg` | `Tripathaka(1)/Tripathaka_247.jpg` |
| `trishula.jpg` | `Trishulam(1)/Trishulam_25.jpg` |

*Note:* `bhramara`, `kangula` and `katakamukha` are cut from the dataset's
earlier representative photographs (previously composited on a dark
background) because no clean frame matched their pose; their edges and colour
are therefore a little rougher.

### Gestures without a photograph of their own

Avatar gestures defined as identical to a two-hand hasta (`matsyavatara`,
`kurmavatara`, `varahavatara`) reuse that hasta's photograph. The deity and
avatar gestures that the mudra database defines as a combination of hastas
(for example Viṣṇu = both hands in Tripatāka) show the **real photographs of
the component hands side by side** (the second copy mirrored for "both
hands"). Nothing is generated or composited into a single image.

### Pose-source images (`poses/src/*.png`)

The original representative frames, composited on a dark background with a
glow effect (one representative frame per mudra, chroma-keyed and resized).
They are kept only as the inputs for 3D pose extraction and recognition tests
and are not displayed.

As derivatives of a CC BY-SA 4.0 work, all of the above are also released
under **CC BY-SA 4.0**.

### Recognition models and reference poses (`models/`, `poses/ref/`)

`models/single.json` and `models/two.json` are neural-network classifiers
trained on hand landmarks that MediaPipe extracted from ~5,000 frames of the
same dataset (about 100 per mudra class, covering its 15 volunteers);
`poses/ref/*.json` are the landmarks of each class's most typical frame. No
images are stored in them. As data derived from a CC BY-SA 4.0 work, they are
released under **CC BY-SA 4.0**. Reproduce with the tools listed in README.md.

## 2. Wikimedia Commons

| File              | Wikimedia title         | Author / source        | Licence                          |
|-------------------|-------------------------|------------------------|----------------------------------|
| `shivalinga.png`  | Hasthamudra14.JPG       | Aruna (ml.wikipedia)   | CC BY-SA 3.0 / 2.5 / 2.0 / 1.0 + GFDL 1.2+ |
| `varaha.png`      | ഹസ്തമുദ്ര2.JPG          | Aruna (ml.wikipedia)   | CC BY-SA 3.0 / 2.5 / 2.0 / 1.0 + GFDL 1.2+ |

Source for each: <https://commons.wikimedia.org/wiki/File:Hasthamudra14.JPG>
and <https://commons.wikimedia.org/wiki/File:%E0%B4%B9%E0%B4%B8%E0%B5%8D%E0%B4%A4%E0%B4%AE%E0%B5%81%E0%B4%A6%E0%B5%8D%E0%B4%B02.JPG>.

Changes made: resized to 600 px wide; format converted from JPEG to PNG.

Mudra Vision applies these images at runtime under CC BY-SA 3.0 (we choose
that licence from the multi-licence offer); if you redistribute, you may also
choose any of the other licences listed by the upstream author.

## Note on terminology

"Not copyrighted" is a stronger claim than these images satisfy — all of the
above are **copyrighted by their authors** but **freely licensed** under
copyleft licences (CC BY-SA / GFDL). You are free to use, modify, and
distribute them, **provided** you (a) credit the authors as above and
(b) keep derivatives under a compatible licence.
