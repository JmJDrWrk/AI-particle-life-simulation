/**
 * ------------------------------------------------------------
 * GUÍA DE PARÁMETROS PARA ANÁLISIS DE DATOS (ML / ESTADÍSTICA)
 * ------------------------------------------------------------
 * Este bloque de configuración define las "leyes de la física" y la 
 * "presión evolutiva" de la simulación. Al analizar los datasets, 
 * los cambios en estas variables explicarán los picos de población, 
 * la tasa de extinción o la velocidad de las generaciones.
 */
export const DEFAULT_PARAMS = {
    
    // =========================================================
    // 1. POBLACIÓN Y LÍMITES GLOBALES
    // =========================================================
    
    // Impacto: Define la densidad inicial. Un valor muy alto causa sobrepoblación 
    // inmediata, forzando colisiones y una explosión de nacimientos en el segundo 1.
    // Un valor muy bajo aumenta el riesgo de extinción prematura porque no se encuentran.
    INITIAL_PARTICLES: 500,
    
    // Impacto: Es el "techo de cristal" de la simulación. En los datos verás que la 
    // población (population) se aplana bruscamente aquí. Al llegar al límite, la 
    // reproducción se bloquea, lo que puede causar ondas de muerte masiva por vejez.
    MAX_PARTICLES: 5000,
    
    // ATENCIÓN ANALISTA: Estas variables están "hardcodeadas" en la función tick() 
    // (siempre se resetean al máximo). No tienen efecto real en la supervivencia en esta versión. 
    // No las incluyas en tu modelo de ML.
    FOOD_MAX: 100,
    WATER_MAX: 100,

    // =========================================================
    // 2. PERCEPCIÓN Y "SOCIABILIDAD"
    // =========================================================
    
    // ATENCIÓN ANALISTA: Esta variable no se usa en la lógica matemática real del engine.mjs.
    INTERACTION_RADIUS: 72,
    
    // Impacto: Es la "visión" real de la partícula (radio al cuadrado). 
    // Si la subes, las partículas ven a otras desde muy lejos: se agrupan rápido (flocking) 
    // y encuentran pareja fácilmente. Si la bajas, actúan como entes ciegos y solitarios.
    NEARBY_RADIUS_NORMALIZED: 0.055,
    
    // Impacto: Límite de vecinos procesados para decidir movimiento. 
    // Mantiene el rendimiento de CPU (evita O(N^2) estricto). Si es muy bajo, en densidades 
    // altas las partículas ignoran a las parejas potenciales que tienen al lado.
    MAX_DECISION_NEARBY: 8,

    // =========================================================
    // 3. DINÁMICAS DE REPRODUCCIÓN (PRESIÓN EVOLUTIVA)
    // =========================================================
    
    // Impacto: Frena las explosiones demográficas. Si es alto, obliga a las partículas 
    // a sobrevivir mucho tiempo antes de criar (baja el ratio de avgGeneration).
    MIN_REPRODUCTION_AGE: 1,
    
    // Impacto: Tiempo de "esterilidad" post-parto. Genera intervalos cíclicos en los 
    // nacimientos. Si es bajo, una pareja puede vaciar toda su energía en un instante 
    // creando múltiples hijos de golpe.
    REPRODUCTION_COOLDOWN: 2,
    
    // Impacto: Probabilidad (60%) de éxito al chocar y cumplir condiciones. 
    // Actúa como un multiplicador directo de la tasa de natalidad en el dataset.
    REPRODUCTION_CHANCE: 0.6,
    
    // Impacto CRÍTICO: Umbrales de energía para criar. Si REPRODUCTION_SELF_MIN_ENERGY 
    // es mayor que INITIAL_ENERGY_MAX, la generación 0 nace estéril y la simulación muere.
    // Restringe la reproducción solo a la "clase alta" energética.
    REPRODUCTION_SELF_MIN_ENERGY: 72,
    REPRODUCTION_PARTNER_MIN_ENERGY: 58,
    
    // Impacto: Coste de dar a luz. Si lo subes mucho, tener un hijo es una sentencia 
    // de muerte por inanición a corto plazo (la energía remanente no dará para vivir).
    REPRODUCTION_SELF_COST: 24,
    REPRODUCTION_PARTNER_COST: 18,
    
    // Impacto: Ventaja competitiva de nacer (Gen > 0). Al estar en 100, los hijos 
    // nacen "ricos" en energía, superando muchas veces a sus padres exhaustos.
    CHILD_INITIAL_ENERGY: 100,

    // =========================================================
    // 4. METABOLISMO Y ESPERANZA DE VIDA
    // =========================================================
    
    // Impacto CRÍTICO: La única causa de muerte prematura. Las partículas pierden energía 
    // constantemente (energy -= dt * drain). Con 0.42, 100 de energía duran ~238 ticks. 
    // Si subes esto, obligas a un ciclo de vida rápido: nacen, crían rápido o mueren.
    ENERGY_DRAIN_PER_SECOND: 0.42,
    
    // Impacto: Límites de tiempo absolutos. Si una partícula no muere por falta de energía, 
    // morirá aquí (age < lifespan). Limita la longevidad máxima incondicionalmente.
    INITIAL_LIFESPAN_MIN: 45,
    INITIAL_LIFESPAN_MAX: 100,

    // Impacto: Energía con la que nace la Gen 0. Define el impulso inicial del sistema.
    INITIAL_ENERGY_MIN: 70,
    INITIAL_ENERGY_MAX: 100,

    // =========================================================
    // 5. FÍSICA, MOVIMIENTO Y COLISIONES
    // =========================================================
    
    // Impacto: Límite de velocidad. Valores altos = sistema caótico, las partículas 
    // cruzan el mapa rápido y mezclan los genes (alta diversidad poblacional). 
    // Valores bajos = formación de tribus locales endogámicas.
    MAX_SPEED: 0.16,
    
    // Impacto: Inercia al cambiar de dirección. Define si los giros son suaves (bajo) o erráticos (alto).
    MOVE_ACCELERATION: 0.0018,
    
    // Impacto: Multiplicador para calcular la zona de incomodidad (minDistance * multiplier).
    // Fuerza a las partículas a mantener distancia. Valores altos esparcen a la población por todo el mapa.
    SEPARATION_DISTANCE_MULTIPLIER: 1.8,
    
    // Impacto: Fuerza con la que se repelen. Un valor muy alto causa "explosiones" físicas 
    // cuando nace un hijo (al spawnear encima de los padres, salen despedidos como balas).
    SEPARATION_STRENGTH: 0.04,
    
    // Impacto: (DECISION_RATE * SPEED_MULTIPLIER) define la frecuencia con la que 
    // evalúan reproducirse o moverse. Afecta directamente al uso de CPU y al nerviosismo del enjambre.
    DECISION_RATE: 1.8,
    SPEED_MULTIPLIER: 2,

    // =========================================================
    // 6. GENÉTICA MORFOLÓGICA Y HERENCIA (MUTACIONES)
    // =========================================================
    
    // Impacto: Desviación aleatoria en el tamaño al nacer. Crea la varianza en `avgRadius`.
    CHILD_RADIUS_MUTATION: 0.6,
    
    // Impacto: Conservación del momento lineal. 0.55 significa que el hijo nace con 
    // la mitad de velocidad que sus padres, tendiendo a quedarse cerca de ellos.
    CHILD_VELOCITY_FACTOR: 0.55,
    
    // Impacto: Añade caos.Aquí tienes el bloque `DEFAULT_PARAMS` comentado. Las explicaciones están enfocadas en el **impacto macroscópico** (dinámica de la población, comportamiento de enjambre y presiones evolutivas) para que te sirvan como guía directa al analizar los datos de tus simulaciones.

```javascript
export const DEFAULT_PARAMS = {
    // ==========================================
    // 1. LIMITADORES DE POBLACIÓN (Demografía)
    // ==========================================
    
    // Impacto: Define la densidad inicial. Valores altos generan un "boom" de 
    // reproducciones temprano al haber más choques entre partículas.
    INITIAL_PARTICLES: 500,
    
    // Impacto: Límite duro (hardware/rendimiento). Si tus simulaciones llegan 
    // rápido a este tope, los datos estarán sesgados por la restricción 
    // artificial y no por el equilibrio del ecosistema.
    MAX_PARTICLES: 5000, 

    // NOTA PARA ANÁLISIS: En el código actual (engine.mjs), food y water 
    // se resetean al máximo en cada tick y no se consumen. Modificar estas 
    // variables NO tendrá ningún efecto en los datos de salida.
    FOOD_MAX: 100,
    WATER_MAX: 100,

    // ==========================================
    // 2. PERCEPCIÓN Y ENTORNO ESPACIAL
    // ==========================================

    // NOTA: Variable "huérfana" en tu código. Se usa NEARBY_RADIUS_NORMALIZED en su lugar.
    INTERACTION_RADIUS: 72, 

    // Impacto: (Escala 0 a 1). Distancia a la que una partícula detecta a otras.
    // Aumentarlo fomenta la formación de "mega-enjambres" (todos se ven).
    // Disminuirlo aísla a las partículas, obligando a encuentros aleatorios.
    NEARBY_RADIUS_NORMALIZED: 0.055, 

    // Impacto: Límite de vecinos procesados para moverse o reproducirse. 
    // Valores altos = enjambres fluidos y comportamiento colectivo complejo. 
    // Valores bajos = movimientos más erráticos y menos clustering (ahorra CPU).
    MAX_DECISION_NEARBY: 8,

    // ==========================================
    // 3. DINÁMICAS DE REPRODUCCIÓN (Crecimiento)
    // ==========================================

    // Impacto: Retrasa el crecimiento exponencial. Valores altos aumentan la
    // brecha generacional y dan tiempo a que la energía se drene antes de criar.
    MIN_REPRODUCTION_AGE: 1, 

    // Impacto: Tiempo de descanso tras tener una cría. Bajarlo permite que 
    // nodos con mucha energía "spameen" crías en segundos si están en un clúster.
    REPRODUCTION_COOLDOWN: 2, 

    // Impacto: Probabilidad (0-1) de éxito al chocar con un candidato válido.
    // Es un freno probabilístico puro. Afecta directamente la tasa de natalidad.
    REPRODUCTION_CHANCE: 0.6, 

    // Impacto: Filtros de fertilidad. Si los subes mucho, solo los recién nacidos 
    // (que arrancan con 100 de energía) podrán reproducirse, haciendo que el 
    // crecimiento poblacional dependa de choques tempranos antes de que se agoten.
    REPRODUCTION_SELF_MIN_ENERGY: 72,
    REPRODUCTION_PARTNER_MIN_ENERGY: 58, 

    // Impacto: Coste metabólico de criar. Valores altos castigan a los padres,
    // acortando su vida útil post-parto e impidiendo que tengan múltiples crías.
    REPRODUCTION_SELF_COST: 24,
    REPRODUCTION_PARTNER_COST: 18, 

    // Impacto: "Gasolina" inicial de una cría. Valores altos garantizan que la cría
    // vivirá lo suficiente para reproducirse a su vez (facilita la sobrepoblación).
    CHILD_INITIAL_ENERGY: 100, 

    // ==========================================
    // 4. METABOLISMO Y SUPERVIVENCIA
    // ==========================================

    // Impacto: CRÍTICO. Es el principal motor de mortalidad del motor.
    // Valores altos acortan la vida real (muerte por energía 0) limitando severamente
    // las ventanas de reproducción. Un cambio pequeño aquí altera todo el dataset.
    ENERGY_DRAIN_PER_SECOND: 0.42, 

    // Impacto: Límites de vida por "vejez" (independientes de la energía).
    // Define cuánto tiempo permanece el ADN de una partícula en el pool genético.
    INITIAL_LIFESPAN_MIN: 45,
    INITIAL_LIFESPAN_MAX: 100,

    // Impacto: Energía con la que empieza la Generación 0.
    INITIAL_ENERGY_MIN: 70,
    INITIAL_ENERGY_MAX: 100,

    // ==========================================
    // 5. FÍSICA Y MOVIMIENTO (Cinemática)
    // ==========================================

    // Impacto: Velocidad límite. Si es muy alta, cruzan el mapa rápido y encuentran
    // pareja, pero también hace que los enjambres sean inestables ("overshooting").
    MAX_SPEED: 0.16, 

    // Impacto: Agilidad. Valores altos hacen que los clústeres vibren mucho y 
    // reaccionen rápido a los vecinos.
    MOVE_ACCELERATION: 0.0018, 

    // Impacto: Define el "espacio personal" mínimo (multiplicado por sus radios).
    // Valores altos crean ecosistemas expansivos; valores bajos permiten
    // agrupaciones muy densas (lo que dispara la tasa de reproducción).
    SEPARATION_DISTANCE_MULTIPLIER: 1.8, 

    // Impacto: Fuerza de repulsión. Si es muy alta, las aglomeraciones explotan
    // violentamente lanzando partículas en todas direcciones.
    SEPARATION_STRENGTH: 0.04, 

    // Impacto: Frecuencia con la que "toman decisiones". Junto con SPEED_MULTIPLIER,
    // subirlo aumenta drásticamente la probabilidad de ejecutar una reproducción por tick.
    DECISION_RATE: 1.8,
    SPEED_MULTIPLIER: 2, 

    // ==========================================
    // 6. GENÉTICA Y MUTACIONES EN CRÍAS
    // ==========================================

    // Impacto: Cuánto cambia el tamaño de una cría respecto a los padres.
    // Valores altos en simulaciones largas generarán divergencia visual rápida.
    CHILD_RADIUS_MUTATION: 0.6, 

    // Impacto: Inercia heredada (0.55 = heredan el 55% de la velocidad de los padres).
    // Si lo acercas a 1.0, las crías salen "disparadas" junto a sus padres.
    CHILD_VELOCITY_FACTOR: 0.55, 

    // Impacto: Ruido espacial al nacer. Valores altos esparcen a las crías, 
    // reduciendo la probabilidad de incesto inmediato o endogamia en el clúster.
    CHILD_POSITION_RANDOMNESS: 0.003,
    CHILD_VELOCITY_RANDOMNESS: 0.04, 

    // ==========================================
    // 7. TAMAÑOS FÍSICOS (Límites y Gen 0)
    // ==========================================
    
    // Impacto: Define la distancia de colisión (y por tanto, de reproducción).
    // Radios más grandes facilitan choques y aumentan la tasa de natalidad neta.
    MIN_RADIUS: 4,
    MAX_RADIUS: 9,
    INITIAL_RADIUS_MIN: 4,
    INITIAL_RADIUS_MAX: 8,

    // Impacto: Impulso inicial para que la simulación no empiece estática.
    INITIAL_VELOCITY_MAX: 0.035,

    // Impacto: Margen (0 a 1) respecto a los bordes del mapa al nacer, 
    // evita que queden atrapadas en las paredes rebotando infinitamente.
    POSITION_MARGIN: 0.04,
};