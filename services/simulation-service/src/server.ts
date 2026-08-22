import Fastify
  from 'fastify';

import {
  ZodError,
} from 'zod';

import {
  runHeadlessSimulation,
} from './runner';

import {
  simulationRequestSchema,
} from './schema';


const server =
  Fastify({
    logger: true,
  });


server.get(
  '/health',
  async () => ({
    status: 'UP',
  })
);


server.post(
  '/simulate',
  async (
    request,
    reply
  ) => {

    try {

      const simulationRequest =
        simulationRequestSchema.parse(
          request.body
        );


      return runHeadlessSimulation(
        simulationRequest
      );

    } catch (error) {

      if (
        error instanceof ZodError
      ) {

        return reply
          .status(400)
          .send({
            error:
              'INVALID_EXPERIMENT_REQUEST',
            issues:
              error.issues,
          });
      }


      request.log.error(
        error
      );


      return reply
        .status(500)
        .send({
          error:
            'SIMULATION_FAILED',
          message:
            error instanceof Error
            ? error.message
            : 'Headless simulation failed.',
        });
    }
  }
);


const port =
  Number(
    process.env.PORT
    ?? 8081
  );

const host =
  process.env.HOST
  ?? '0.0.0.0';


await server.listen({
  port,
  host,
});
