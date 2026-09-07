/* =========================================================
   ALANSA - SISTEMA DE CONTROL AGRÍCOLA

   API:
   SIEMBRAS / CONTRATOS

   Archivo:
   functions/api/plantings.js

   Funciones:
   - Consultar siembras.
   - Crear nuevas siembras.
   - Actualizar siembras.
   - Eliminar siembras cuando no tengan movimientos.
   - Calcular automáticamente el costo estimado de semilla.
   ========================================================= */


/* =========================================================
   1. IMPORTACIONES
   ========================================================= */

import {
  json,
  error
} from './_util.js';


/* =========================================================
   2. CONSULTAR SIEMBRAS
   ========================================================= */

export async function onRequestGet({
  env
}) {

  const result =
    await env.DB
      .prepare(`
        SELECT
          pl.*,
          p.name AS product_name,
          c.name AS client_name

        FROM plantings pl

        JOIN products p
          ON p.id = pl.product_id

        JOIN clients c
          ON c.id = pl.client_id

        ORDER BY
          pl.harvest_start DESC,
          pl.id DESC
      `)
      .all();


  return json(
    result.results || []
  );

}


/* =========================================================
   3. CREAR NUEVA SIEMBRA
   ========================================================= */

export async function onRequestPost({
  env,
  request
}) {

  const data =
    await request.json();


  /* ---------------------------------------------------------
     3.1. CONVERTIR VALORES NUMÉRICOS
     --------------------------------------------------------- */

  const hectares =
    Number(
      data.hectares || 0
    );

  const density =
    Number(
      data.density_per_ha || 0
    );

  const seedCost =
    Number(
      data.seed_cost_per_thousand || 0
    );


  /* ---------------------------------------------------------
     3.2. VALIDACIONES OBLIGATORIAS
     --------------------------------------------------------- */

  if (
    !data.contract_number ||
    !data.product_id ||
    !data.client_id
  ) {

    return error(
      'Contrato, cliente y producto son obligatorios.'
    );

  }


  if (
    hectares <= 0 ||
    density <= 0
  ) {

    return error(
      'Hectáreas y densidad deben ser mayores a cero.'
    );

  }


  if (
    !data.harvest_start ||
    !data.harvest_end
  ) {

    return error(
      'Debes indicar el periodo de cosecha.'
    );

  }


  if (
    data.harvest_end <
    data.harvest_start
  ) {

    return error(
      'La fecha final de cosecha no puede ser anterior a la fecha inicial.'
    );

  }


  /* ---------------------------------------------------------
     3.3. COSTO ESTIMADO DE SEMILLA

     Fórmula:

     Hectáreas
     × semillas por hectárea
     ÷ 1,000
     × costo por millar
     --------------------------------------------------------- */

  const estimatedSeedCost =
    (
      hectares *
      density /
      1000
    ) *
    seedCost;


  /* ---------------------------------------------------------
     3.4. GUARDAR EN D1
     --------------------------------------------------------- */

  try {

    const result =
      await env.DB
        .prepare(`
          INSERT INTO plantings (

            contract_number,

            product_id,

            client_id,

            hectares,

            density_per_ha,

            seed_cost_per_thousand,

            estimated_seed_cost,

            actual_seed_cost,

            seed_currency,

            harvest_start,

            harvest_end,

            price_per_box,

            price_currency,

            standard_box_lbs,

            trailers_per_week,

            status,

            notes

          )

          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
        `)
        .bind(

          data.contract_number.trim(),

          Number(
            data.product_id
          ),

          Number(
            data.client_id
          ),

          hectares,

          density,

          seedCost,

          estimatedSeedCost,

          data.actual_seed_cost === ''
            ? null
            : Number(
                data.actual_seed_cost
              ),

          data.seed_currency ||
            'USD',

          data.harvest_start,

          data.harvest_end,

          Number(
            data.price_per_box || 0
          ),

          data.price_currency ||
            'USD',

          Number(
            data.standard_box_lbs || 12
          ),

          Number(
            data.trailers_per_week || 1
          ),

          data.status ||
            'Activa',

          data.notes ||
            null

        )
        .run();


    return json({
      ok: true,

      id:
        result.meta
          ?.last_row_id,

      estimated_seed_cost:
        estimatedSeedCost
    });

  } catch (exception) {

    const message =
      String(
        exception.message || ''
      );


    if (
      message.includes(
        'UNIQUE'
      )
    ) {

      return error(
        'Ya existe una siembra con ese número de contrato.'
      );

    }


    return error(
      'No fue posible guardar la siembra.'
    );

  }

}


/* =========================================================
   4. ACTUALIZAR SIEMBRA
   ========================================================= */

export async function onRequestPut({
  env,
  request
}) {

  const data =
    await request.json();


  /* ---------------------------------------------------------
     4.1. IDENTIFICADOR
     --------------------------------------------------------- */

  const id =
    Number(
      data.id
    );


  if (
    !id
  ) {

    return error(
      'Falta el identificador de la siembra.'
    );

  }


  /* ---------------------------------------------------------
     4.2. VALORES NUMÉRICOS
     --------------------------------------------------------- */

  const hectares =
    Number(
      data.hectares || 0
    );

  const density =
    Number(
      data.density_per_ha || 0
    );

  const seedCost =
    Number(
      data.seed_cost_per_thousand || 0
    );


  /* ---------------------------------------------------------
     4.3. RECALCULAR COSTO ESTIMADO
     --------------------------------------------------------- */

  const estimatedSeedCost =
    (
      hectares *
      density /
      1000
    ) *
    seedCost;


  /* ---------------------------------------------------------
     4.4. ACTUALIZAR REGISTRO
     --------------------------------------------------------- */

  try {

    await env.DB
      .prepare(`
        UPDATE plantings

        SET

          contract_number = ?,

          product_id = ?,

          client_id = ?,

          hectares = ?,

          density_per_ha = ?,

          seed_cost_per_thousand = ?,

          estimated_seed_cost = ?,

          actual_seed_cost = ?,

          seed_currency = ?,

          harvest_start = ?,

          harvest_end = ?,

          price_per_box = ?,

          price_currency = ?,

          standard_box_lbs = ?,

          trailers_per_week = ?,

          status = ?,

          notes = ?,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = ?
      `)
      .bind(

        data.contract_number.trim(),

        Number(
          data.product_id
        ),

        Number(
          data.client_id
        ),

        hectares,

        density,

        seedCost,

        estimatedSeedCost,

        data.actual_seed_cost === ''
          ? null
          : Number(
              data.actual_seed_cost
            ),

        data.seed_currency ||
          'USD',

        data.harvest_start,

        data.harvest_end,

        Number(
          data.price_per_box || 0
        ),

        data.price_currency ||
          'USD',

        Number(
          data.standard_box_lbs || 12
        ),

        Number(
          data.trailers_per_week || 1
        ),

        data.status ||
          'Activa',

        data.notes ||
          null,

        id

      )
      .run();


    return json({
      ok: true,

      estimated_seed_cost:
        estimatedSeedCost
    });

  } catch {

    return error(
      'No fue posible actualizar la siembra.'
    );

  }

}


/* =========================================================
   5. ELIMINAR SIEMBRA
   ========================================================= */

export async function onRequestDelete({
  env,
  request
}) {

  const body =
    await request.json();


  const id =
    Number(
      body.id
    );


  if (
    !id
  ) {

    return error(
      'Falta el identificador de la siembra.'
    );

  }


  /* ---------------------------------------------------------
     La base de datos impedirá eliminar una siembra
     que ya tenga movimientos relacionados.
     --------------------------------------------------------- */

  try {

    await env.DB
      .prepare(`
        DELETE FROM plantings

        WHERE id = ?
      `)
      .bind(
        id
      )
      .run();


    return json({
      ok: true
    });

  } catch {

    return error(
      'Esta siembra ya tiene movimientos relacionados y no puede eliminarse.'
    );

  }

}
