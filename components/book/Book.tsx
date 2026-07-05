/* Ported from the 3D-book prototype (Wawa-Sensei-style skinned-mesh book).
   The bone-flip math is kept verbatim; jotai atoms are replaced with props so
   it drops into the gallery without a global store. */
import { useCursor, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  new MeshStandardMaterial({ color: '#111' }),
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
  setPage: (n: number) => void;
  [key: string]: any;
}

const Page = ({ number, front, back, page, opened, bookClosed, totalPages, setPage, ...props }: PageProps) => {
  const [picture, picture2] = useTexture([front, back]);
  useMemo(() => {
    picture.colorSpace = picture2.colorSpace = SRGBColorSpace;
  }, [picture, picture2]);

  const group = useRef<any>(null);
  const turnedAt = useRef(0);
  const lastOpened = useRef(opened);
  const skinnedMeshRef = useRef<any>(null);
  const [highlighted, setHighlighted] = useState(false);
  useCursor(highlighted);

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

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
    if (!bookClosed) targetRotation += degToRad(number * 0.8);

    const bones = skinnedMeshRef.current.skeleton.bones;
    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i];
      const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
      const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
      const turningIntensity = Math.sin(i * Math.PI * (1 / bones.length)) * turningTime;
      let rotationAngle =
        insideCurveStrength * insideCurveIntensity * targetRotation -
        outsideCurveStrength * outsideCurveIntensity * targetRotation +
        turningCurveStrength * turningIntensity * targetRotation;
      let foldRotationAngle = degToRad(Math.sign(targetRotation) * 2);
      if (bookClosed) {
        if (i === 0) { rotationAngle = targetRotation; foldRotationAngle = 0; }
        else { rotationAngle = 0; foldRotationAngle = 0; }
      }
      easing.dampAngle(target.rotation, 'y', rotationAngle, easingFactor, delta);
      const foldIntensity = i > 8 ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime : 0;
      easing.dampAngle(target.rotation, 'x', foldRotationAngle * foldIntensity, easingFactorFold, delta);
    }
  });

  return (
    <group
      {...props}
      ref={group}
      onPointerEnter={(e: any) => { e.stopPropagation(); setHighlighted(true); }}
      onPointerLeave={(e: any) => { e.stopPropagation(); setHighlighted(false); }}
      onClick={(e: any) => { e.stopPropagation(); setPage(opened ? number : number + 1); setHighlighted(false); }}
    >
      <primitive object={manualSkinnedMesh} ref={skinnedMeshRef} position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH} />
    </group>
  );
};

interface BookProps {
  pages: BookLeaf[];
  page: number;
  setPage: (n: number) => void;
  [key: string]: any;
}

export const Book = ({ pages, page, setPage, ...props }: BookProps) => {
  const [delayedPage, setDelayedPage] = useState(page);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const goToPage = () => {
      setDelayedPage((dp) => {
        if (page === dp) return dp;
        timeout = setTimeout(goToPage, Math.abs(page - dp) > 2 ? 50 : 150);
        return page > dp ? dp + 1 : dp - 1;
      });
    };
    goToPage();
    return () => clearTimeout(timeout);
  }, [page]);

  return (
    <group {...props} rotation-y={-Math.PI / 2}>
      {pages.map((leaf, index) => (
        <Page
          key={index}
          page={delayedPage}
          number={index}
          front={leaf.front}
          back={leaf.back}
          opened={delayedPage > index}
          bookClosed={delayedPage === 0 || delayedPage === pages.length}
          totalPages={pages.length}
          setPage={setPage}
        />
      ))}
    </group>
  );
};
