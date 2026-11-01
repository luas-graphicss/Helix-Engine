import type { GameSources } from '../types';
export function csharpGame(): GameSources {
    const entry = `                                    
                                                                                  
                                                                                   
using Helix;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public class DebugJogo : ActorScript
{
    private const string LINGUAGEM = "C#";
                                                                                                                                  
    private const float PRAZO_AREA = 5f;

    private int quadros;
    private int passosFisica;
    private int lateUpdates;
    private int renders;
    private int rendersHook;
    private int colisoes;
    private int checagens;
    private int falhas;
    private int pontos;
    private float hudTimer;
    private dynamic torus;
    private dynamic heroi;
    private dynamic efeito;
    private dynamic tela;
    private readonly List<Action> assinaturas = new();

    private static float[] V(float x, float y, float z) => new[] { x, y, z };

    private void Checar(string nome, bool condicao, object detalhe = null)
    {
        checagens++;
        if (condicao) return;
        falhas++;
        Helix.Log.Error("Debug", $"FALHOU {nome}{(detalhe == null ? "" : $": {detalhe}")}");
    }

    private async Task Area(string nome, Func<Task> fn)
    {
        var concluida = false;
        var execucao = Task.Run(fn);
        Func<Task> prazo = async () =>
        {
            await Helix.Time.Wait(PRAZO_AREA);
            if (!concluida) throw new TimeoutException($"excedeu {PRAZO_AREA} s e foi abandonada");
        };
        try
        {
            await Task.WhenAny(execucao, prazo());
            await execucao;
            Helix.Log.Debug("Debug", $"ok {nome}");
        }
        catch (Exception erro)
        {
            falhas++;
            Helix.Log.Error("Debug", $"ERRO em {nome}: {erro.Message}");
        }
        finally
        {
            concluida = true;
        }
    }

    private static bool Aprox(double a, double b, double epsilon = 0.001) => Math.Abs(a - b) <= epsilon;

                                                                                                   

    private Task Nucleo()
    {
        Checar("engine.name", Helix.Engine.Name is string nome && nome.Length > 0);
        Checar("engine.version", Helix.Engine.Version is string);
        Checar("context", new[] { "shared", "client", "server" }.Contains((string)Helix.Context), Helix.Context);
        Checar("isPlaying", Helix.IsPlaying == true);
        Checar("isEditor", Helix.IsEditor == false);
        Checar("editor ausente no jogo", Helix.Editor == null);
        Checar("self no script de entrada", Helix.Self == null, Helix.Self?.Name);
        Checar("script handle", Helix.Script == null || Helix.Script.Name == "DebugJogo", Helix.Script?.Name);
        Checar("camelCase também resolve", helix.engine.name == Helix.Engine.Name);
        Helix.Log.Info("Debug", $"{Helix.Engine.Name} {Helix.Engine.Version} · API {Helix.Engine.ApiVersion} · {LINGUAGEM}");
        return Task.CompletedTask;
    }

    private Task Modulo()
    {
        Checar("módulo Soma", DebugUtil.Soma(2, 3) == 5, DebugUtil.Soma(2, 3));
        Checar("módulo Saudacao", DebugUtil.Saudacao("Helix") == "Olá, Helix", DebugUtil.Saudacao("Helix"));
        Checar("módulo Limitar", DebugUtil.Limitar(15, 0, 10) == 10);
        Checar("módulo constante", DebugUtil.Versao == "1.0");
        return Task.CompletedTask;
    }

    private Task Matematica()
    {
        var m = Helix.Math;
        var v = m.Vec3.Add(V(1, 2, 3), V(1, 1, 1));
        Checar("vec3.add", m.Vec3.Equals(v, V(2, 3, 4)), m.Vec3.ToArray(v));
        Checar("vec3.length", Aprox(m.Vec3.Length(V(3, 4, 0)), 5));
        Checar("vec3.normalize", Aprox(m.Vec3.Length(m.Vec3.Normalize(V(0, 5, 0))), 1));
        Checar("vec3.cross", m.Vec3.Equals(m.Vec3.Cross(V(1, 0, 0), V(0, 1, 0)), V(0, 0, 1)));
        Checar("vec3.lerp", m.Vec3.Equals(m.Vec3.Lerp(V(0, 0, 0), V(2, 2, 2), 0.5), V(1, 1, 1)));
        var q = m.Quat.FromEuler(V(0, 90, 0));
        var r = m.Quat.RotateVec3(q, V(1, 0, 0));
        Checar("quat.rotateVec3", m.Vec3.Equals(r, V(0, 0, -1), 0.001), m.Vec3.ToArray(r));
        Checar("quat.toEuler", Aprox(m.Quat.ToEuler(q)[1], 90, 0.01));
        var mat = m.Mat4.FromTRS(V(1, 2, 3), V(0, 0, 0), V(1, 1, 1));
        Checar("mat4.transformPoint", m.Vec3.Equals(m.Mat4.TransformPoint(mat, V(0, 0, 0)), V(1, 2, 3)));
        Checar("mat4.invert", m.Mat4.Invert(mat) != null);
        Checar("mat4.decompose", m.Vec3.Equals(m.Mat4.Decompose(mat).Translation, V(1, 2, 3)));
        var caixa = m.Aabb.FromCenterSize(V(0, 0, 0), V(2, 2, 2));
        Checar("aabb.contains", m.Aabb.Contains(caixa, V(0.5f, 0.5f, 0.5f)) && !m.Aabb.Contains(caixa, V(2, 0, 0)));
        Checar("aabb.size", m.Vec3.Equals(m.Aabb.Size(caixa), V(2, 2, 2)));
        var raio = m.Ray.Create(V(0, 5, 0), V(0, -1, 0));
        Checar("ray.intersectAabb", m.Ray.IntersectAabb(raio, caixa) != null);
        Checar("ray.at", m.Vec3.Equals(m.Ray.At(raio, 5), V(0, 0, 0)));
        Checar("scalar.remap", m.Scalar.Remap(5, 0, 10, 0, 100) == 50);
        Checar("scalar.clamp/lerp", m.Clamp(15, 0, 10) == 10 && m.Lerp(0, 10, 0.5) == 5);
        Checar("scalar.wrapAngle", Aprox(m.Scalar.WrapAngle(370), 10));
        Checar("scalar.smoothstep", m.Scalar.Smoothstep(0, 1, 0.5) == 0.5);
        Checar("degToRad", Aprox(m.DegToRad(180), Math.PI));
        double ruido = m.Noise.Perlin2(0.3, 0.7);
        Checar("noise.perlin2", double.IsFinite(ruido) && ruido >= -1.01 && ruido <= 1.01, ruido);
        Checar("noise.fbm", double.IsFinite(m.Noise.Fbm(1.5, 2.5, 0, 4)));
        Checar("noise.worley2", double.IsFinite(m.Noise.Worley2(0.2, 0.4)));
        Checar("color.hexToVec3", m.Vec3.Equals(m.Color.HexToVec3("#ff0000"), V(1, 0, 0), 0.01));
        Checar("color.vec3ToHex", ((string)m.Color.Vec3ToHex(V(1, 1, 1))).ToLower() == "#ffffff", m.Color.Vec3ToHex(V(1, 1, 1)));
        Checar("color.parse", m.Color.Parse("#00ff00")[1] > 0.99);
        Checar("color.hsl", m.Color.Hsl(0, 1, 0.5)[0] > 0.99);
        Checar("color.temperatureToColor", m.Color.TemperatureToColor(6500).Length == 3);
        m.Random.Seed(42);
        var a = m.Random.Value();
        m.Random.Seed(42);
        Checar("random.seed determinístico", m.Random.Value() == a);
        Checar("random.int", double.IsInteger(m.Random.Int(1, 6)));
        Checar("random.pick", new[] { "a", "b" }.Contains((string)m.Random.Pick(new[] { "a", "b" })));
        Checar("random.shuffle", m.Random.Shuffle(new[] { 1, 2, 3 }).Length == 3);
        Checar("random.unitVector", Aprox(m.Vec3.Length(m.Random.UnitVector()), 1));
        Checar("random.create", m.Random.Create("debug").Range(0, 1) is double);
        Checar("PI/TAU", m.TAU == m.PI * 2);
        return Task.CompletedTask;
    }

                                                                                                         

    private Task Cena()
    {
        var s = Helix.Scene;
        Checar("scene.root", s.Root != null && s.Root.Children is Array);
        var antes = s.Count();
        var grupo = s.Spawn("group", new { name = "DebugCenario" });
        var chao = s.Spawn("mesh", new
        {
            name = "Chao",
            mesh = Helix.Mesh.Plane(40, 40),
            material = Helix.Material.Create(new { baseColor = "#4b6b3a", roughness = 0.95 }),
            rigidBody = new { type = "static", collider = "box", boxSize = V(40, 0.2f, 40), center = V(0, -0.1f, 0) },
            receiveShadows = true,
            tags = new[] { "chao" },
        }, grupo);
        Checar("spawn mesh", chao.Kind == "mesh" && chao.Mesh != null && chao.RigidBody != null);
        Checar("find", s.Find("Chao") == chao);
        Checar("findAll", s.FindAll("Chao").Length == 1);
        Checar("byId", s.ById(chao.Id) == chao);
        Checar("byTag", s.ByTag("chao").Contains(chao));
        Checar("byKind", s.ByKind("mesh").Contains(chao));
        Checar("count", s.Count() == antes + 2, $"{s.Count()} vs {antes + 2}");
        Checar("contains", s.Contains(grupo, chao) && s.Contains(s.Root, chao));
        Checar("path", ((string)s.Path(chao)).Contains("Chao"), s.Path(chao));
        Checar("all", s.All().Contains(chao));
        var visitados = 0;
        s.Traverse(_ => visitados++, grupo);
        Checar("traverse", visitados >= 2, visitados);

        var anel = s.SpawnPrimitive("torus", new { name = "Anel", position = V(-4, 1.2f, -2), scale = 1.5 }, grupo);
        Helix.Material.SetColor(anel, "#3a86ff");
        Helix.Material.SetEmissive(anel, "#3a86ff", 0.6);
        torus = anel;
        Checar("spawnPrimitive", anel.Mesh != null && anel.Material != null);

        var copia = s.Clone(anel, true, grupo);
        s.Rename(copia, "AnelCopia");
        Helix.Transform.SetPosition(copia, V(-4, 1.2f, 2));
        Checar("clone + rename", copia.Name == "AnelCopia" && s.Find("AnelCopia") == copia);
        s.SetMeta(copia, "origem", "clone");
        Checar("meta", s.GetMeta(copia, "origem") == "clone");
        s.AddTag(copia, "temporario");
        Checar("addTag/hasTag", s.HasTag(copia, "temporario"));
        Checar("removeTag", s.RemoveTag(copia, "temporario") == true && !s.HasTag(copia, "temporario"));
        s.SetVisible(copia, false);
        Checar("setVisible", copia.Visible == false);
        s.SetVisible(copia, true);
        s.Destroy(copia);
        Checar("destroy", s.Find("AnelCopia") == null && !s.IsAttached(copia));

        var esfera = s.SpawnPrimitive("sphere", new { name = "Esfera", position = V(4, 0.5f, -3) });
        s.Reparent(esfera, grupo);
        Checar("reparent", esfera.Parent == grupo);
        Helix.Material.SetColor(esfera, "#ffbe0b");
        s.AddComponent(esfera, "rigidBody", new { type = "dynamic", collider = "sphere", radius = 0.5, mass = 1 });
        Checar("addComponent", esfera.RigidBody != null && esfera.RigidBody.Type == "dynamic");
        var temporario = s.SpawnPrimitive("box", new { name = "Temporario" });
        s.AddComponent(temporario, "csg", new { });
        Checar("addComponent csg", temporario.Csg != null);
        s.RemoveComponent(temporario, "csg");
        Checar("removeComponent", temporario.Csg == null);
        s.Destroy(temporario);
        Checar("kinds/components", s.Kinds().Contains("mesh") && s.Components().Contains("rigidBody"));
        Checar("sun", s.Sun == null || s.Sun.Light != null);
        return Task.CompletedTask;
    }

    private Task Transformacao()
    {
        var t = Helix.Transform;
        var m = Helix.Math;
        var alvo = Helix.Scene.SpawnPrimitive("cone", new { name = "Cone", position = V(0, 0.5f, -6) });
        Helix.Material.SetColor(alvo, "#8338ec");
        t.SetPosition(alvo, V(2, 0.5f, -6));
        Checar("setPosition/position", m.Vec3.Equals(t.Position(alvo), V(2, 0.5f, -6)));
        t.Translate(alvo, V(0, 1, 0), "world");
        Checar("translate", Aprox(t.Position(alvo)[1], 1.5));
        t.SetRotation(alvo, V(0, 90, 0));
        Checar("setRotation", Aprox(t.Rotation(alvo)[1], 90));
        t.Rotate(alvo, V(0, 45, 0));
        Checar("rotate", Aprox(m.Scalar.WrapAngle(t.Rotation(alvo)[1]), 135, 0.01) || Aprox(t.Rotation(alvo)[1], 135, 0.01), t.Rotation(alvo)[1]);
        t.SetScale(alvo, 2);
        Checar("setScale", t.Scale(alvo)[0] == 2);
        t.SetScale(alvo, V(1, 1, 1));
        Checar("worldPosition", m.Vec3.Equals(t.WorldPosition(alvo), t.Position(alvo), 0.001));
        Checar("worldRotation", t.WorldRotation(alvo).Length == 4);
        Checar("forward unitário", Aprox(m.Vec3.Length(t.Forward(alvo)), 1));
        Checar("up", m.Vec3.Equals(t.Up(alvo), V(0, 1, 0), 0.001));
        t.LookAt(alvo, V(0, 1.5f, 0));
        Checar("distance", Aprox(t.Distance(alvo, V(2, 1.5f, -6)), 0, 0.01));
        Checar("directionTo", Aprox(m.Vec3.Length(t.DirectionTo(alvo, V(0, 1.5f, 0))), 1, 0.01));
        var limites = t.Bounds(alvo);
        Checar("bounds", limites.Max[1] > limites.Min[1]);
        var local = t.WorldToLocal(alvo, t.LocalToWorld(alvo, V(1, 0, 0)));
        Checar("localToWorld/worldToLocal", m.Vec3.Equals(local, V(1, 0, 0), 0.001));
        Checar("worldMatrix", t.WorldMatrix(alvo).Length == 16 && t.LocalMatrix(alvo).Length == 16);
        var pai = Helix.Scene.Spawn("group", new { name = "PaiDoCone", position = V(0, 0, -6) });
        t.SetParentKeepWorld(alvo, pai);
        Checar("setParentKeepWorld", alvo.Parent == pai && m.Vec3.Equals(t.WorldPosition(alvo), V(2, 1.5f, -6), 0.01));
        t.RotateAround(alvo, V(0, 1.5f, -6), V(0, 1, 0), 90);
        Checar("rotateAround", Aprox(t.Distance(alvo, V(0, 1.5f, -6)), 2, 0.01));
        return Task.CompletedTask;
    }

    private Task Malhas()
    {
        var m = Helix.Mesh;
        var caixa = m.Box(1, 1, 1);
        Checar("mesh.box", m.VertexCount(caixa) > 0 && m.TriangleCount(caixa) == 12, m.TriangleCount(caixa));
        var esfera = m.Sphere(0.65, 16, 12);
        var furado = Helix.Csg.Boolean(caixa, esfera, "subtract");
        Checar("csg.boolean", m.TriangleCount(furado) > 12);
        var ator = Helix.Scene.Spawn("mesh", new { name = "CaixaFurada", mesh = furado, material = Helix.Material.Create(new { baseColor = "#e63946", roughness = 0.4, metallic = 0.2 }), position = V(4, 0.5f, 2) });
        Checar("spawn malha CSG", ator.Mesh == furado);
        Checar("csg.operations", Helix.Csg.Operations().Contains("union"));

        var tri = m.Create(new { name = "Triangulo", positions = new[] { -1f, 0f, 0f, 1f, 0f, 0f, 0f, 1.5f, 0f }, uvs = new[] { 0f, 0f, 1f, 0f, 0.5f, 1f }, indices = new[] { 0, 1, 2 } });
        m.ComputeNormals(tri);
        Checar("mesh.create + computeBounds", m.ComputeBounds(tri).Max[1] >= 1.5);
        var dupla = m.Merge(tri, m.FlipWinding(m.Clone(tri)));
        Checar("mesh.merge", m.TriangleCount(dupla) == 2);
        Helix.Scene.Spawn("mesh", new { name = "Triangulo", mesh = dupla, material = Helix.Material.Create(new { baseColor = "#06d6a0", doubleSided = true }), position = V(7, 0, -2) });
        var grande = m.Scale(m.Translate(m.Clone(caixa), V(0, 0.5f, 0)), 2);
        Checar("mesh.translate/scale", m.ComputeBounds(grande).Max[1] > 1.9);
        var dist = m.Raycast(Helix.Math.Ray.Create(V(0, 5, 0), V(0, -1, 0)), grande);
        Checar("mesh.raycast", dist != null && dist > 0, dist);
        var n = 0;
        m.ForEachVertex(caixa, _ => n++);
        Checar("forEachVertex", n == m.VertexCount(caixa));
        Checar("positions/indices", m.Positions(caixa).Length == m.VertexCount(caixa) * 3 && m.Indices(caixa).Length == 36);
        var versao = m.Version(caixa);
        m.Positions(caixa)[1] += 0.01f;
        m.MarkDirty(caixa);
        Checar("markDirty/version", m.Version(caixa) > versao);
`;
}
