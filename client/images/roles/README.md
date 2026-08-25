# Carpeta de imagenes de roles

Coloca aqui las 27 imagenes de las cards de roles, con el patron de nombre
`card_<id_sin_guion_bajo>.webp` (asi es como vienen tus archivos actualmente):

```
card_villager.webp
card_seer.webp
card_doctor.webp
card_werewolf.webp
card_alphawolf.webp
card_vampire.webp
card_witch.webp
card_siren.webp
card_shapeshifter.webp
card_nightmare.webp
card_wolfshaman.webp
card_knight.webp
card_princess.webp
card_hunter.webp
card_necromancer.webp
card_king.webp
card_jester.webp
card_lycan.webp
card_mayor.webp
card_assassin.webp
card_towncrier.webp
card_lover.webp
card_druid.webp
card_mystic.webp
card_thief.webp
card_courtesan.webp
card_bard.webp
```

El sistema en `client/js/roleAssets.js` genera automaticamente este nombre de
archivo a partir del id interno del rol (quitando los guiones bajos), asi que
no necesitas renombrar nada si tus archivos ya siguen este patron.

Si en el futuro cambias el patron de nombres o la extension, edita las funciones
`getRoleImageFileName()` e `IMAGE_EXTENSION` en `client/js/roleAssets.js`.

Si falta la imagen de un rol o no carga, el sitio no se rompe: automaticamente
se muestra un emoji y color de fallback definidos en `ROLE_ASSETS` dentro de
`client/js/roleAssets.js`.
