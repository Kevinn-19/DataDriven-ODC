# ODC Data Driven Manager

Objeto Digital de Conocimiento (ODC) **«Data Driven Manager: Herramientas de Big Data y Analítica para la Toma de Decisiones Organizacionales»**, empaquetado como **SCORM 1.2** para Moodle.

Universidad de Cundinamarca · Especialización en Inteligencia Artificial
Autores: Kevin Esteban Chiquillo Díaz y Dominic Nicolás Alonso Barajas

## Contenido

33 pantallas en ocho módulos, con Insight como guía virtual:

1. Fundamentos de Big Data y Business Analytics
2. Calidad y gobernanza de datos
3. Analítica descriptiva, predictiva y prescriptiva
4. Sistemas de apoyo a la decisión
5. Inteligencia artificial aplicada a la gestión
6. Visualización e interpretación de datos
7. Casos empresariales reales (Netflix, UPS, Walmart)
8. Simuladores de toma de decisiones

Incluye actividades de arrastrar y soltar, el detective de datos, cuestionarios, la ficha de análisis de caso, dos simuladores, la evaluación final (10 preguntas), conclusiones, créditos y referencias en APA 7.

## Estructura

```
scorm/                 Paquete SCORM (todo lo que va dentro del ZIP)
  imsmanifest.xml      Manifiesto SCORM 1.2
  index.html           Las 33 pantallas y el sprite de íconos Lucide
  css/styles.css       Sistema visual: variables de tema, componentes y puntos de quiebre
  js/scorm.js          Conexión con el LMS (API SCORM 1.2)
  js/app.js            Navegación, índice lateral, audio de Insight, actividades y calificación
  assets/insight.png   Avatar de Insight
  assets/LICENSE-lucide.txt  Licencia de los íconos (ISC)
  fonts/               Fuente Plus Jakarta Sans (licencia SIL OFL)
  audio/               (vacía) locuciones opcionales de Insight
  video/               Videos del avatar de Insight (32 MP4 verticales)
probar-lms.html        LMS de prueba para revisar el paquete sin Moodle
tools/servidor.py      Servidor local para las pruebas (permite adelantar los videos)
tools/empaquetar.py    Genera el ZIP para Moodle
```

## Probar en local

El curso necesita un servidor local (si se abre con doble clic, el navegador bloquea la conexión con el LMS de prueba):

```bash
python tools/servidor.py
```

Se usa este servidor y no `python -m http.server` porque responde a las peticiones por rangos: sin ellas el navegador no puede adelantar un video ni continuarlo desde un punto. Moodle ya lo hace.

Luego abre <http://127.0.0.1:8765/probar-lms.html>. La barra superior muestra en vivo el estado, la nota, la ubicación y las interacciones que el curso envía al LMS. **Reiniciar intento** borra el progreso.

## Generar el paquete para Moodle

```bash
python tools/empaquetar.py
```

Crea `dist/ODC_DataDrivenManager_SCORM12.zip`. En Moodle: *Agregar una actividad → Paquete SCORM* y sube el ZIP sin descomprimirlo.

## Calificación

| Componente | Peso |
|---|---|
| Actividades de módulo (1 a 7) | 40 % |
| Simuladores (2) | 35 % |
| Evaluación final (10 preguntas × 10 puntos) | 25 % |

Se aprueba con **70 o más**. El estado `passed`/`failed` se envía al terminar la evaluación final; antes, el estado es `incomplete`. Los pesos y la nota mínima se cambian en `WEIGHTS` y `PASS_SCORE`, en [`scorm/js/app.js`](scorm/js/app.js).

## Apariencia y accesibilidad

- **Estructura tipo plataforma:** barra lateral con el índice agrupado por módulo, el avance (pantallas vistas) y la pantalla actual. Es fija desde 1100 px de ancho; en pantallas más pequeñas se abre con el botón de menú.
- **Pantalla completa:** en escritorio y tableta horizontal el contenido llena todo el alto disponible. Las tarjetas tienen una franja ilustrada con el color del tema, un ícono grande y una marca de agua. Junto a Insight y en el celular, las tarjetas pasan a formato horizontal.
- **Actividades:** las instrucciones aparecen como aviso destacado. Los cuestionarios llevan una ilustración y el avance a un lado y las opciones en mosaicos grandes. Las zonas de arrastrar y soltar, la clasificación del detective, la ficha de caso y las fases del proceso de decisión tienen su propio ícono.
- **Diseño adaptable (mobile-first):** puntos de quiebre en 640, 900, 1100 y 1440 px. En el celular las tarjetas pasan a una columna y la tabla del detective de datos se muestra como fichas, sin desplazamiento horizontal.
- **Íconos:** [Lucide](https://lucide.dev) v1.58.0, incluidos en `index.html` como sprite SVG (no se descargan de internet). Se usan con `<svg class="i"><use href="#i-nombre"/></svg>`.
- **Tipografía:** Plus Jakarta Sans (variable), incluida en `scorm/fonts/`.
- **Modo oscuro/claro:** botón de luna/sol en la barra superior. Al inicio sigue el tema del sistema; la elección queda guardada en el navegador. Cambia fondos, tarjetas, bordes, textos, íconos y gráficos.
- **Contraste:** todos los pares de texto y fondo del sistema miden 5:1 o más en ambos temas (WCAG AA pide 4,5:1).
- **Pausar animaciones:** botón de pausa en la barra superior. Si el sistema tiene activado «reducir movimiento», el curso empieza con las animaciones en pausa.

Los colores están en [`scorm/css/styles.css`](scorm/css/styles.css), en `:root` (claro) y `:root[data-theme="dark"]` (oscuro): superficies (`--bg-primary`, `--card-bg`, `--card-border`), texto (`--text-color`, `--text-muted`, `--heading-color`, `--icon-color`) y colores de módulo. Cada color de módulo tiene una versión sólida para rellenos con texto blanco (`--teal`) y otra para texto e íconos (`--teal-fg`).

La versión anterior al rediseño está en `respaldo/scorm-antes-del-rediseno/` (no se incluye en el ZIP).

## Video del avatar de Insight

Cada pantalla indica su video con el atributo `data-video` de su `<section>` en `index.html` (por ejemplo `data-video="modulo1-1"` usa `scorm/video/modulo1-1.mp4`). Para cambiar o agregar un video: copia el MP4 en `scorm/video/`, ponle el nombre en `data-video` y agrega una línea `<file href="video/nombre.mp4"/>` en `imsmanifest.xml`. `USE_AVATAR_VIDEO` en `app.js` activa o desactiva todos los videos.

| Videos | Pantallas |
|---|---|
| `modulo0-1`, `modulo0-2` | Portada, Ruta de aprendizaje |
| `modulo1-1`, `modulo1-2` | Big Data, Business Analytics |
| `modulo2-1`, `modulo2-2` | Calidad de los datos, Normativa y gobernanza |
| `modulo3-1` | Los tres niveles de la analítica |
| `modulo4-1`, `modulo4-2` | Sistemas de apoyo a la decisión, El proceso de decisión |
| `modulo5-1`, `modulo5-2`, `modulo5-3` | IA aplicada a la gestión, IA generativa, IA responsable |
| `act1` … `act7` | Actividades 1 a 7 (solo voz) |
| `evaluacionFinal1`, `evaluacionFinal2` | Evaluación final, partes 1 y 2 (solo voz) |
| `conclusion` | Conclusiones y siguientes pasos |
| `modulo6-1`, `modulo6-2`, `modulo6-3` | Principios de visualización, Cómo leer un dashboard, Gráficos engañosos |
| `modulo7-1` … `modulo7-4` | Casos empresariales reales, Netflix, UPS, Walmart |
| `modulo8-1`, `modulo8-2`, `modulo8-3` | Simuladores de decisión, Simulador 1, Simulador 2 |

- **Adelantar y retroceder:** la barra de avance se toca o se arrastra para ir a cualquier punto, y con el teclado las flechas mueven 5 segundos. En la ventana hay además botones de −10 s y +10 s y el tiempo transcurrido.
- **En la pantalla:** la tarjeta de Insight trae el video listo para reproducir (botón de reproducir y barra de avance). **Ver más** abre la ventana con la transcripción y el mismo video, que sigue desde donde iba; al cerrarla, la tarjeta queda en ese punto.
- **En las actividades y la evaluación final** Insight no aparece: la ventana muestra una onda de voz y la transcripción, y se oye solo el audio del video. La regla está en la función `isActivity` de `app.js`.
- **Sin video** (créditos): no hay tarjeta de Insight; si alguna pantalla no tiene video, Insight muestra su imagen y lee el guion con la voz del navegador.

## Audio de Insight

Por defecto, Insight lee el guion de cada pantalla con la voz del navegador. Para usar locuciones grabadas, guárdalas como `scorm/audio/pantalla-01.mp3`, `pantalla-02.mp3`, … (número de pantalla con dos dígitos), agrégalas a `imsmanifest.xml` y cambia `USE_AUDIO_FILES` a `true` en `scorm/js/app.js`.

## Licencias

- Fuente **Plus Jakarta Sans**: SIL Open Font License 1.1 ([`scorm/fonts/OFL.txt`](scorm/fonts/OFL.txt)).
- Íconos **Lucide**: licencia ISC ([`scorm/assets/LICENSE-lucide.txt`](scorm/assets/LICENSE-lucide.txt)).
