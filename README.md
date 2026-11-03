# Sketch

**Sketch** is a browser-based photo-to-contour-sketch studio. Upload a photo, turn it into a clean line drawing with OpenCV.js, then keep your three newest results on a tactile Looseleaf-inspired bulletin board.

The experience is intentionally local-first: source photos are processed in the browser, and the latest sketches are stored in that browser's local storage so they are still waiting on the board when the visitor returns.

## Features

- Upload JPG, PNG, or WebP images from the browser.
- Convert a photo to a contour sketch using OpenCV.js.
- Extract the foreground before edge detection for cleaner subject outlines.
- Preview the original image or open a sketch at a larger size.
- Download generated sketches as PNG files.
- Persist the three most recent original/sketch pairs in `localStorage`.
- Present the workspace with Looseleaf paper stocks, torn/deckled edges, staples, clips, and paper texture.

## How it works

The pipeline runs completely in the client after OpenCV.js has loaded:

```text
Photo
  ↓
Foreground extraction (GrabCut)
  ↓
Grayscale conversion
  ↓
Gaussian smoothing
  ↓
Canny edge detection
  ↓
Line sketch (PNG)
```

Images are scaled down to a maximum dimension of 1200 px before processing. This keeps memory use and browser processing time reasonable while retaining enough detail for a useful sketch.

### 1. Foreground extraction / background removal

Before detecting edges, the app uses OpenCV's **GrabCut** algorithm with an inset rectangle. Pixels near the outside of the image begin as likely background; pixels inside the rectangle begin as probable foreground. GrabCut then iteratively refines those labels using color models and a graph cut.

At a high level, it minimizes an energy function:

$$
E(L) = \sum_p D_p(L_p) + \lambda \sum_{(p,q)} V_{p,q}(L_p, L_q)
$$

where:

- Lₚ is the foreground/background label for pixel p;
- Dₚ is the data cost: how well a pixel's colour fits the foreground or background colour model;
- V(p, q) is the smoothness cost between neighboring pixels; and
- λ balances colour fit against smooth, coherent regions.

Pixels labelled foreground or probable foreground are retained; the rest is painted white before later stages.

#### Why remove the background first?

Canny does not know which edges belong to the subject. A detailed wall, foliage, patterned clothing behind the subject, or a busy room can create far more edges than the actual photo subject. Removing likely background pixels first means the edge detector spends its threshold budget on the subject, produces less visual noise, and creates a sketch that is easier to read.

GrabCut works best when the main subject is reasonably centered and the outer border is mostly background. For the best result, use an image with a clean, uncluttered background.

### 2. Grayscale conversion

Edge detection works on intensity changes, not colour names. The foreground image is converted from BGR/RGB to a single grayscale intensity channel. A common perceptual luminance approximation is:

$$
Y = 0.299R + 0.587G + 0.114B
$$

The coefficients are unequal because the human visual system is more sensitive to green than blue. Reducing the image to one intensity value per pixel simplifies the following filtering and gradient calculations.

### 3. Gaussian smoothing

Small sensor noise, JPEG artifacts, and tiny texture changes can look like edges. The grayscale image is blurred with a 7 × 7 Gaussian kernel and σ = 1.5:

$$
G(x,y) = \frac{1}{2\pi\sigma^2}\exp\left(-\frac{x^2+y^2}{2\sigma^2}\right)
$$

Each output pixel is a weighted average of nearby pixels. The weights are highest at the centre and decrease smoothly with distance. This preserves large shapes while suppressing high-frequency noise that would otherwise create false contours.

### 4. Canny edge detection

The smoothed image is passed to OpenCV's Canny detector with low and high thresholds of 54 and 145. Canny has four stages:

#### 1. Image gradients

Horizontal and vertical intensity changes are estimated with Sobel derivatives, Gₓ and Gᵧ.

#### 2. Gradient strength and direction

Edge strength is calculated as:

$$
|G| = \sqrt{G_x^2 + G_y^2}
$$

The gradient direction is:

$$
\theta = \mathrm{atan2}(G_y, G_x)
$$

#### 3. Non-maximum suppression

Only a local maximum along the gradient direction is kept, thinning broad edge bands into narrow lines.

#### 4. Double threshold and hysteresis

Strong edges are retained immediately; weak edges are kept only when connected to strong edges. This avoids both noisy speckles and broken important lines.

The remaining edge mask is rendered as dark ink on warm paper, then exported as a PNG data URL.

## Data and privacy

The selected image is processed in the browser. The application stores only the generated data URLs for the three most recent original/sketch pairs in the current browser's `localStorage` under `looseleaf-sketches-v1`.

There is no application image-upload API or project database. OpenCV.js itself is loaded from the OpenCV CDN at runtime, so the app requires a network connection the first time the image-processing library is needed.

## Notes and limitations

- GrabCut is a foreground-estimation technique, not a semantic segmentation model. It may struggle with a subject that blends into the background.
- `localStorage` has limited capacity; the app retains only three reduced-size results for this reason.
- Processing performance depends on the device, image size, and the time required to load OpenCV.js.
