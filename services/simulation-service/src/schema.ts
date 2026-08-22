import {
  z,
} from 'zod';


const roadNodeSchema =
  z.object({
    id:
      z.number()
        .int(),
    latitude:
      z.number()
        .finite()
        .min(-90)
        .max(90),
    longitude:
      z.number()
        .finite()
        .min(-180)
        .max(180),
  });


const roadEdgeSchema =
  z.object({
    from:
      z.number()
        .int(),
    to:
      z.number()
        .int(),
    lengthMeters:
      z.number()
        .finite()
        .positive(),
    speedLimitMps:
      z.number()
        .finite()
        .positive(),
  });


export const simulationRequestSchema =
  z.object({
    network:
      z.object({
        nodes:
          z.array(
            roadNodeSchema
          )
            .min(2),
        edges:
          z.array(
            roadEdgeSchema
          )
            .min(1),
      })
        .superRefine(
          (network, context) => {

            const nodeIds =
              new Set<number>();


            for (
              const node
              of network.nodes
            ) {

              if (
                nodeIds.has(
                  node.id
                )
              ) {

                context.addIssue({
                  code:
                    'custom',
                  message:
                    `Duplicate road node ${node.id}.`,
                  path: [
                    'nodes',
                  ],
                });
              }


              nodeIds.add(
                node.id
              );
            }


            for (
              const edge
              of network.edges
            ) {

              if (
                !nodeIds.has(
                  edge.from
                )
                ||
                !nodeIds.has(
                  edge.to
                )
              ) {

                context.addIssue({
                  code:
                    'custom',
                  message:
                    `Road edge ${edge.from}->${edge.to} references an unknown node.`,
                  path: [
                    'edges',
                  ],
                });
              }
            }
          }
        ),
    closedSegmentKeys:
      z.array(
        z.string()
          .regex(
            /^\d+-\d+$/
          )
      ),
    requestedVehicleCount:
      z.number()
        .int()
        .min(1)
        .max(100_000),
    seed:
      z.number()
        .int()
        .min(0)
        .max(0xFFFF_FFFF),
    comparisonEnabled:
      z.boolean(),
    maxSimulationSeconds:
      z.number()
        .finite()
        .positive()
        .max(86_400)
        .default(1_800),
  });
