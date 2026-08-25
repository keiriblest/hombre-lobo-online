# Carpeta de imagenes de roles

Coloca aqui un archivo de imagen por cada uno de los 27 roles, con el nombre EXACTO
del id del rol (en ingles, en minusculas, con guion bajo donde corresponda) y
extension `.webp`:

```
villager.webp
seer.webp
doctor.webp
werewolf.webp
alpha_wolf.webp
vampire.webp
witch.webp
siren.webp
shapeshifter.webp
nightmare.webp
wolf_shaman.webp
knight.webp
princess.webp
hunter.webp
necromancer.webp
king.webp
jester.webp
lycan.webp
mayor.webp
assassin.webp
town_crier.webp
lover.webp
druid.webp
mystic.webp
thief.webp
courtesan.webp
bard.webp
```

Si tus imagenes tienen otra extension (por ejemplo `.png` o `.jpg`), edita la
constante `IMAGE_EXTENSION` en `client/js/roleAssets.js`.

Si falta la imagen de un rol o no carga, el sitio no se rompe: automaticamente
se muestra un emoji y color de fallback definidos en `ROLE_ASSETS` dentro de
`client/js/roleAssets.js`.
