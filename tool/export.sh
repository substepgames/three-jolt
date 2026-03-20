#!/bin/sh

for f in resource/blend/*.blend; do
    blender -b $f -P tool/gltfExport.py &
done

wait

gzip -kf9n public/glb/*.glb
