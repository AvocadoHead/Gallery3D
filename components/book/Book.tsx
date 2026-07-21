/* Ported from the 3D-book prototype (AvocadoHead/the-3d-book, Wawa-Sensei-style
   skinned-mesh book). The flip math below is kept IDENTICAL to the prototype,
   which is the proven-good reference. The only deliberate deviations, each for
   gallery scale (70+ leaves vs the prototype's ~15):
   1. The per-leaf fan angle shrinks with book size (static, prototype formula
      at small counts) — NEVER make the fan depend on the current page: a
      page-relative fan re-targets every leaf on every turn, which made leaves
      ease through each other (flicker) and the stacks lean (imbalance).
   2. Leaves far from the spread render as untextured FarPage stubs (memory).
      Stubs MUST use the exact same z-offset and fan formulas as real pages —
      a mismatched z-offset made the stub stack float behind the book as
      "frame lines".
   3. Pages snap to their pose on mount (no ease-in sweep) so stub↔real
      window transitions are invisible.
   4. Large jumps snap most of the distance (R7) and flatten the turn curve
      (riffle) instead of animating 30 mid-air turns. */
import { useCursor, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bone,
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { degToRad } from 'three/src/math/MathUtils.js';
import type { BookLeaf } from './bookTextures';

// Prototype-identical constants
const easingFactor = 0.5;
const easingFactorFold = 0.3;
const insideCurveStrength = 0.18;
const outsideCurveStrength = 0.05;
const turningCurveStrength = 0.09;
const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

/* Static per-leaf fan: identical to the prototype (0.8°/leaf) for small books,
   scaled down so a 70-leaf book fans ~12° in total instead of 57°. */
const fanDegPerLeaf = (totalPages: number) => Math.min(0.8, 12 / Math.max(1, totalPages));

/* Flatten the resting page bow as the book grows. The inside/outside curve
   that gives an open page its lifelike bow is a FIXED amplitude, but leaves
   are stacked only PAGE_DEPTH apart — so once dozens of bowed leaves share the
   spread they slice through each other (vertical strips of the next page show
   through, edges cross at top/bottom). Small books (≤ the all-real window)
   keep the full prototype bow; larger books ease toward a flatter page so the
   bow can never exceed the separation between neighbours. Applied identically
   to real pages (Page) and baked stubs (FarPage) so the two stay seamless. */
const curveScaleFor = (totalPages: number) => Math.max(0.4, Math.min(1, 24 / Math.max(1, totalPages)));

/* Spine break: lift each open half off the flat 180° spread so the book arches
   toward the viewer, like a real book on a stand. 0 = flat (old behaviour). It
   is a rigid tilt at the hinge (bone 0) so the proven page curl is untouched —
   the two halves just rotate up. Bonus: angularly separating the two leaf
   stacks further reduces corner-cutting between leaves. The angle (degrees) is
   a per-gallery setting the owner controls; this is the default. */
export const DEFAULT_SPINE_ANGLE = 28;

/* A thin book already opens to a nearly-flat spread, so the full break tips it
   past flat ("flipped inside out"). Ease the break in with leaf count: none at
   ≤5 leaves, full by ~16. Keeps the owner's chosen angle honest at every size. */
const spineTaper = (totalPages: number) => Math.min(1, Math.max(0, (totalPages - 5) / 11));

/* Resting bow of a COVER leaf (first/last), relative to a normal page's bow.
   A cover reads better stiffer than an inner page, but too rigid (near 0) makes
   it a flat plane that slices through the still-stacked leaves while it swings
   open — the "first page passes through the stack" glitch. A little bow curls
   the cover's outer edge away from the stack so it clears the leaves beneath.
   Single tunable knob: 0.3 = old rigid, 1.0 = a full page's bow. */
const COVER_BOW = 0.55;

const pageGeometry = new BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_DEPTH, PAGE_SEGMENTS, 2);
pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);
{
  const position = pageGeometry.attributes.position;
  const vertex = new Vector3();
  const skinIndexes: number[] = [];
  const skinWeights: number[] = [];
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const x = vertex.x;
    const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
    const skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;
    skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
    skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
  }
  pageGeometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndexes, 4));
  pageGeometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4));
}

const whiteColor = new Color('white');
const emissiveColor = new Color('orange');
const pageMaterials = [
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: whiteColor }), // white spine — no gutter stripe
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: whiteColor }),
];

interface PageProps {
  number: number;
  front: string;
  back: string;
  page: number;
  opened: boolean;
  bookClosed: boolean;
  totalPages: number;
  riffle: boolean;
  spineRad: number;
  setPage: (n: number) => void;
  [key: string]: any;
}

const Page = ({ number, front, back, page, opened, bookClosed, totalPages, riffle, spineRad, setPage, ...props }: PageProps) => {
  const [picture, picture2] = useTexture([front, back]);
  useMemo(() => {
    picture.colorSpace = picture2.colorSpace = SRGBColorSpace;
  }, [picture, picture2]);

  const group = useRef<any>(null);
  const turnedAt = useRef(0);
  const lastOpened = useRef(opened);
  const skinnedMeshRef = useRef<any>(null);
  const firstFrame = useRef(true);
  const [highlighted, setHighlighted] = useState(false);
  useCursor(highlighted);

  // R1: only the two pages adjacent to the current spread are interactive
  const clickable = number === page || number === page - 1;

  const manualSkinnedMesh = useMemo(() => {
    const bones: Bone[] = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new Bone();
      bones.push(bone);
      bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH;
      if (i > 0) bones[i - 1].add(bone);
    }
    const skeleton = new Skeleton(bones);

    const frontMaterial = new MeshStandardMaterial({
      color: whiteColor,
      map: picture,
      roughness: 0.8,
      metalness: 0.1,
      emissive: emissiveColor,
      emissiveIntensity: 0,
    });
    const backMaterial = new MeshStandardMaterial({
      color: whiteColor,
      map: picture2,
      roughness: 0.8,
      metalness: 0.1,
      emissive: emissiveColor,
      emissiveIntensity: 0,
    });

    const materials = [...pageMaterials, frontMaterial, backMaterial];
    const mesh = new SkinnedMesh(pageGeometry, materials as any);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);
    return mesh;
  }, [picture, picture2]);

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current) return;

    const emissiveIntensity = highlighted ? 0.1 : 0;
    skinnedMeshRef.current.material[4].emissiveIntensity =
      skinnedMeshRef.current.material[5].emissiveIntensity = MathUtils.lerp(
        skinnedMeshRef.current.material[4].emissiveIntensity,
        emissiveIntensity,
        0.1,
      );

    if (lastOpened.current !== opened) {
      turnedAt.current = +new Date();
      lastOpened.current = opened;
    }
    let turningTime = Math.min(400, +new Date() - turnedAt.current) / 400;
    turningTime = Math.sin(turningTime * Math.PI);
    if (riffle) turningTime = 0;

    // Prototype-identical: STATIC fan by absolute leaf index (scaled for size).
    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
    if (!bookClosed) {
      targetRotation += degToRad(number * fanDegPerLeaf(totalPages));
    }

    // Big books flatten their resting bow so stacked leaves stop crossing.
    // Only the resting inside/outside curve scales — the page-turn (turning)
    // bow is left at full strength so flipping still looks alive.
    // Covers (first/last leaf) are stiffened: a full-bleed cover reads better
    // rigid, and it is the one leaf whose bow is exposed when the book is barely
    // open, where the wave crossed the page beneath it.
    const isCover = number === 0 || number === totalPages - 1;
    const curveScale = curveScaleFor(totalPages) * (isCover ? COVER_BOW : 1);
    const bones = skinnedMeshRef.current.skeleton.bones;
    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i];
      const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
      const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
      const turningIntensity = Math.sin(i * Math.PI * (1 / bones.length)) * turningTime;
      let rotationAngle =
        curveScale * insideCurveStrength * insideCurveIntensity * targetRotation -
        curveScale * outsideCurveStrength * outsideCurveIntensity * targetRotation +
        turningCurveStrength * turningIntensity * targetRotation;
      let foldRotationAngle = degToRad(Math.sign(targetRotation) * 2);
      if (bookClosed) {
        if (i === 0) { rotationAngle = targetRotation; foldRotationAngle = 0; }
        else { rotationAngle = 0; foldRotationAngle = 0; }
      }
      // Spine break: rigid lift of the whole half at the hinge (bone 0 only).
      if (i === 0 && !bookClosed) rotationAngle += opened ? -spineRad : spineRad;
      const foldIntensity = i > 8 ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime : 0;

      if (firstFrame.current) {
        // Snap to pose on mount — no ease-in sweep when a stub is promoted to
        // a real page (or on initial build).
        target.rotation.y = rotationAngle;
        target.rotation.x = foldRotationAngle * foldIntensity;
      } else {
        easing.dampAngle(target.rotation, 'y', rotationAngle, easingFactor, delta);
        easing.dampAngle(target.rotation, 'x', foldRotationAngle * foldIntensity, easingFactorFold, delta);
      }
    }
    firstFrame.current = false;
  });

  return (
    <group
      {...props}
      ref={group}
      // R1: only highlight/click pages adjacent to the current spread
      onPointerEnter={(e: any) => { e.stopPropagation(); if (clickable) setHighlighted(true); }}
      onPointerLeave={(e: any) => { e.stopPropagation(); setHighlighted(false); }}
      onClick={(e: any) => {
        e.stopPropagation();
        if (!clickable) return;
        setPage(opened ? number : number + 1);
        setHighlighted(false);
      }}
    >
      <primitive object={manualSkinnedMesh} ref={skinnedMeshRef} position-z={leafZ(number, page)} />
    </group>
  );
};

interface BookProps {
  pages: BookLeaf[];
  page: number;
  setPage: (n: number) => void;
  spineAngle?: number; // degrees; owner-controlled per gallery
  [key: string]: any;
}

/* ---------- FarPage: untextured stand-in for leaves far from the spread ----------
   A real resting page is NOT flat: its ±90° target is distributed along the
   bone chain by the inside/outside curve strengths, so the page curls. A flat
   plane rotated ±90° therefore protrudes from the curved stack — that (plus a
   missing `+ page * PAGE_DEPTH` z term) was the "frame lines floating behind
   the book" bug. Fix: bake the exact rest-pose curl into a static geometry
   once (linear blend skinning applied on the CPU with the same formulas). */
const bakeRestGeometry = (T: number, amp = 1) => {
  // Per-level local rotations at rest (turningTime = 0, fold = 0) — the same
  // formula Page uses in useFrame. `amp < 1` bakes a slightly FLATTER curl so
  // stubs sit strictly inside the bow of the real pages above them.
  const rot: number[] = [];
  for (let i = 0; i <= PAGE_SEGMENTS; i++) {
    const inside = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
    const outside = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
    rot.push((insideCurveStrength * inside * T - outsideCurveStrength * outside * T) * amp);
  }
  // Accumulate the bone chain: world origin + accumulated Y-angle per bone.
  const angles: number[] = [];
  const origins: { x: number; z: number }[] = [];
  let acc = 0;
  for (let i = 0; i <= PAGE_SEGMENTS; i++) {
    acc += rot[i];
    angles.push(acc);
    if (i === 0) origins.push({ x: 0, z: 0 });
    else {
      const p = origins[i - 1];
      const a = angles[i - 1];
      origins.push({ x: p.x + Math.cos(a) * SEGMENT_WIDTH, z: p.z - Math.sin(a) * SEGMENT_WIDTH });
    }
  }
  const geo = pageGeometry.clone();
  const pos = geo.attributes.position;
  const skinIdx = geo.attributes.skinIndex;
  const skinW = geo.attributes.skinWeight;
  const transformBy = (j: number, x: number, z: number) => {
    const lx = x - j * SEGMENT_WIDTH; // local offset in bind space
    const a = angles[j];
    return {
      x: origins[j].x + Math.cos(a) * lx + Math.sin(a) * z,
      z: origins[j].z - Math.sin(a) * lx + Math.cos(a) * z,
    };
  };
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v);
    const z = pos.getZ(v);
    const j0 = Math.min(PAGE_SEGMENTS, skinIdx.getX(v));
    const j1 = Math.min(PAGE_SEGMENTS, skinIdx.getY(v));
    const w0 = skinW.getX(v);
    const w1 = skinW.getY(v);
    const p0 = transformBy(j0, x, z);
    const p1 = transformBy(j1, x, z);
    pos.setX(v, p0.x * w0 + p1.x * w1);
    pos.setZ(v, p0.z * w0 + p1.z * w1);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
};

// Rest curl for unopened (+90°) and opened (−90°). Stubs are baked 10% flatter
// so they tuck inside the real pages' bow. The bow amplitude tracks the same
// curveScale the real pages use (flatter on big books), so a stub and the real
// page it stands in for keep the identical shape. Baked lazily and cached per
// distinct scale — a book only ever uses one, so this bakes at most twice.
type RestGeo = ReturnType<typeof bakeRestGeometry>;
const restGeometryCache = new Map<number, { closed: RestGeo; opened: RestGeo }>();
const getRestGeometries = (curveScale: number) => {
  const key = Math.round(curveScale * 100) / 100;
  let g = restGeometryCache.get(key);
  if (!g) {
    g = {
      closed: bakeRestGeometry(Math.PI / 2, 0.9 * curveScale),
      opened: bakeRestGeometry(-Math.PI / 2, 0.9 * curveScale),
    };
    restGeometryCache.set(key, g);
  }
  return g;
};

/* Stack position of a leaf. The base formula is the prototype's; the cushion
   adds extra clearance for the top few leaves of each stack so the textured
   pages right beneath the open spread can never intersect it (the "stripes"
   artifact on thick books). Applied directly as a prop — no easing — so it
   can never cause transient crossings. */
const leafZ = (number: number, page: number) => {
  const stackZ = (page - number) * PAGE_DEPTH;
  const sideIdx = number >= page ? number - page : page - 1 - number; // 0 = top of its side
  const cushion = Math.min(3, sideIdx) * PAGE_DEPTH;
  return number >= page ? stackZ - cushion : stackZ + cushion;
};

const FarPage = ({ number, opened, page, totalPages, bookClosed, spineRad }: {
  number: number; opened: boolean; page: number; totalPages: number; bookClosed: boolean; spineRad: number;
}) => {
  // When the book is closed, real pages go FLAT (i=0 takes the full rotation);
  // otherwise they rest in the baked curl, fanned by their static leaf angle.
  const isCover = number === 0 || number === totalPages - 1;
  const rest = getRestGeometries(curveScaleFor(totalPages) * (isCover ? COVER_BOW : 1));
  const geometry = bookClosed ? pageGeometry : opened ? rest.opened : rest.closed;
  const rotation = bookClosed
    ? (opened ? -Math.PI / 2 : Math.PI / 2)
    : degToRad(number * fanDegPerLeaf(totalPages)) + (opened ? -spineRad : spineRad);
  return (
    <group rotation-y={rotation}>
      <mesh
        geometry={geometry}
        material={pageMaterials as any}
        scale={[0.998, 0.998, 1]}
        position-z={leafZ(number, page)}
        frustumCulled={false}
      />
    </group>
  );
};

export const Book = ({ pages, page, setPage, spineAngle = DEFAULT_SPINE_ANGLE, ...props }: BookProps) => {
  const [delayedPage, setDelayedPage] = useState(page);

  // Owner's spine angle (degrees) → radians, eased in for thin books.
  const spineRad = degToRad(spineAngle * spineTaper(pages.length));

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const goToPage = () => {
      setDelayedPage((dp) => {
        if (page === dp) return dp;
        const dist = Math.abs(page - dp);
        // R7: large jumps (>6 leaves) snap most of the distance in one step
        if (dist > 6) {
          timeout = setTimeout(goToPage, 0);
          return page > dp ? page - 3 : page + 3;
        }
        timeout = setTimeout(goToPage, dist > 4 ? 30 : dist > 2 ? 50 : 150);
        return page > dp ? dp + 1 : dp - 1;
      });
    };
    goToPage();
    return () => clearTimeout(timeout);
  }, [page]);

  const jump = Math.abs(page - delayedPage);
  const riffle = jump > 4;
  const bookClosed = delayedPage === 0 || delayedPage === pages.length;

  // Books up to prototype scale render every leaf for real — zero stubs.
  // Big books keep a tight ±2 window: only the leaves at the spread carry
  // textures (deeper textured leaves were the source of the "stripes").
  const windowSize = pages.length <= 24 ? pages.length : 2;

  return (
    <group {...props} rotation-y={-Math.PI / 2}>
      {pages.map((leaf, index) => {
        const near =
          Math.abs(index - delayedPage) <= windowSize ||
          Math.abs(index + 1 - delayedPage) <= windowSize;
        const stub = (
          <FarPage
            number={index}
            opened={delayedPage > index}
            page={delayedPage}
            totalPages={pages.length}
            bookClosed={bookClosed}
            spineRad={spineRad}
          />
        );
        if (!near) return <React.Fragment key={index}>{stub}</React.Fragment>;
        // Per-page Suspense: while a newly-promoted page decodes its textures
        // it renders as its own stub. A single book-wide boundary here used to
        // blank the ENTIRE book for a frame on every page turn.
        return (
          <Suspense key={index} fallback={stub}>
            <Page
              page={delayedPage}
              number={index}
              front={leaf.front}
              back={leaf.back}
              opened={delayedPage > index}
              bookClosed={bookClosed}
              totalPages={pages.length}
              riffle={riffle}
              spineRad={spineRad}
              setPage={setPage}
            />
          </Suspense>
        );
      })}
    </group>
  );
};
