# k8s — Conversion Pulse

Manifests de topologia de produção (Deployment 3→10 réplicas via HPA, StatefulSet Postgres com PVC, Ingress nginx).

## Subir num cluster kind local

```bash
kind create cluster --name cpulse

docker build -t cpulse-api:latest .
kind load docker-image cpulse-api:latest --name cpulse

cp k8s/secret.example.yaml k8s/secret.local.yaml
# editar k8s/secret.local.yaml com credenciais reais antes de aplicar
# depois trocar secret.example.yaml por secret.local.yaml no kustomization.yaml local (não versionar o local)

kubectl apply -k k8s/
```

## Ordem de apply (o `kustomization.yaml` já resolve isso, mas se aplicar manifest a manifest a ordem é)

1. `namespace.yaml`
2. `secret.example.yaml` (ou o secret real equivalente)
3. `configmap.yaml`
4. `postgres-statefulset.yaml`
5. `api-deployment.yaml`
6. `api-service.yaml`
7. `hpa.yaml`
8. `ingress.yaml`

## Verificar

```bash
kubectl -n conversion-pulse get pods -w
kubectl -n conversion-pulse get hpa
```

## Decisões

- Schema do banco (`db/init/01_schema.sql`) não é embarcado nos manifests: `kubectl kustomize` recusa referenciar arquivo fora da raiz do kustomization por segurança, e scripts em `/docker-entrypoint-initdb.d` só rodam com `PGDATA` vazio — em produção real o schema é aplicado por job de migração separado, não por bootstrap do container. Para ambiente kind, aplicar o schema manualmente após o StatefulSet ficar pronto: `kubectl -n conversion-pulse exec -i cpulse-db-0 -- psql -U cpulse -d cpulse < db/init/01_schema.sql`.
- `api-deployment.yaml` usa `readOnlyRootFilesystem: true` com `emptyDir` em `/tmp` — Nest/Fastify não precisam escrever em outro lugar do filesystem do container em runtime.
- `secret.example.yaml` só tem placeholders. Nunca aplicar em produção sem trocar `POSTGRES_PASSWORD` e `DATABASE_URL`.
- `ingress.yaml` usa host placeholder `cpulse.example.local` — trocar pelo domínio real antes de aplicar em produção.
