FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY backend/spring-api/pom.xml .
RUN mvn -q -DskipTests dependency:go-offline

COPY backend/spring-api/src ./src
RUN mvn -q test package


FROM eclipse-temurin:21-jre-alpine AS runtime

WORKDIR /app

COPY --from=build /workspace/target/spring-api-0.1.0.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
