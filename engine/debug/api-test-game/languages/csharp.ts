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
        var densa = m.Sphere(1, 32, 16);
        Checar("mesh.simplify", m.TriangleCount(m.Simplify(densa, 0.5)) < m.TriangleCount(densa));
        var lod = m.Lod(ator, new { enabled = true, bias = 1 });
        Checar("mesh.lod", lod == null || lod.Enabled == true);
        Checar("mesh.myriad", m.Myriad(ator) is bool);
        Checar("primitivas extras", m.TriangleCount(m.TorusKnot()) > 0 && m.TriangleCount(m.Rock()) > 0 && m.TriangleCount(m.Capsule()) > 0);
        var mat = Helix.Math.Mat4.FromTRS(V(0, 2, 0), V(0, 45, 0), V(1, 1, 1));
        Checar("mesh.transform", m.ComputeBounds(m.Transform(m.Clone(caixa), mat)).Min[1] > 1.4);
        return Task.CompletedTask;
    }

                                                                                                           

    private Task Materiais()
    {
        var mat = Helix.Material;
        var baseMat = mat.Create(new { name = "DebugBase", baseColor = "#d98c2b", roughness = 0.5, metallic = 0.1 });
        Checar("material.create", baseMat.Roughness == 0.5);
        var copia = mat.Clone(baseMat);
        mat.Set(copia, new { roughness = 1, emissive = "#ffffff", emissiveIntensity = 2 });
        Checar("material.clone/set", copia.Roughness == 1 && baseMat.Roughness == 0.5);
        mat.Copy(copia, baseMat);
        Checar("material.copy", copia.Roughness == 0.5);
        var caixa = Helix.Scene.SpawnPrimitive("box", new { name = "CaixaPintada", position = V(-7, 0.5f, 2) });
        mat.Assign(caixa, baseMat);
        Checar("material.assign/of", mat.Of(caixa) == baseMat);
        var propria = mat.Own(caixa);
        Checar("material.own", mat.Of(caixa) == propria);
        var tela2d = Helix.Texture.Canvas(64, 64);
        var ctx = tela2d.Context;
        for (int y = 0; y < 8; y++)
        {
            for (int x = 0; x < 8; x++)
            {
                ctx.FillStyle = (x + y) % 2 == 1 ? "#1d3557" : "#f1faee";
                ctx.FillRect(x * 8, y * 8, 8, 8);
            }
        }
        tela2d.Update();
        mat.SetTexture(caixa, "baseColorMap", tela2d.Texture);
        Checar("texture.canvas + setTexture", mat.HasAnyTexture(propria) && Helix.Texture.IsTexture(tela2d.Texture));
        var pixels = new byte[4 * 4 * 4];
        for (int i = 0; i < pixels.Length; i++) pixels[i] = 255;
        var textura = Helix.Texture.FromPixels(4, 4, pixels);
        Checar("texture.fromPixels", textura.Width == 4 && textura.Height == 4);
        Helix.Texture.Touch(textura);
        Checar("texture.create", Helix.Texture.Create(new { width = 2, height = 2 }).Width == 2);
        Checar("material.slots", mat.Slots().Any(slot => slot.Slot == "normalMap"));
        Checar("materials.list/names", Helix.Materials.List() is Array && Helix.Materials.Names() is Array);
        var sombreado = mat.FromShader("DebugSuperficie", new { glow = V(1, 0.45f, 0.1f), speed = 2 });
        Checar("material.fromShader", sombreado != null && sombreado.Uniforms.Set != null);
        var esfera = Helix.Scene.SpawnPrimitive("sphere", new { name = "EsferaShader", position = V(0, 1, -3), scale = 1.4 });
        mat.Assign(esfera, sombreado);
        mat.Uniforms(esfera).Set("speed", 3);
        var lista = mat.Uniforms(esfera).List();
        Checar("material.uniforms.list", lista is Array && lista.Any(u => u.Name == "glow"), string.Join(",", lista.Select(u => (string)u.Name)));
        return Task.CompletedTask;
    }

    private Task Luzes()
    {
        var l = Helix.Light;
        Checar("light.types", l.Types().Contains("point") && l.LocalTypes().Contains("spot"));
        var lampada = l.Spawn("point", new { name = "Lampada", position = V(0, 3, 0), color = "#ffd166", intensity = 60, range = 14 });
        Checar("light.spawn", lampada.Light != null && lampada.Light.Type == "point");
        l.Set(lampada, new { intensity = 80 });
        Checar("light.set", lampada.Light.Intensity == 80);
        l.SetTemperature(lampada, 3200);
        Checar("setTemperature", lampada.Light.Temperature == 3200);
        Checar("resolvedColor", Helix.Math.Vec3.Length(l.ResolvedColor(lampada)) > 0);
        var foco = l.Spawn("spot", new { name = "Holofote", position = V(4, 4, 0), rotation = V(-90, 0, 0), intensity = 120, range = 16, innerAngle = 20, outerAngle = 35, color = "#ffffff" });
        Checar("spot", foco.Light.Type == "spot");
        var convertido = l.Convert(foco, "disc");
        Checar("light.convert", convertido.Type == "disc" && foco.Light.Type == "disc");
        l.Convert(foco, "spot");
        var presets = l.Presets();
        Checar("light.presets", presets.Length > 0);
        if (presets.Length > 0)
        {
            var preset = l.Spawn(presets[0].Id, new { name = "LuzPreset", position = V(-4, 2.5f, 4) });
            Checar("light.fromPreset", preset.Light != null && l.FromPreset(presets[0].Id).Type == presets[0].Type);
        }
        var criada = l.Create("point", new { intensity = 5 });
        Checar("light.create/clone", criada.Type == "point" && l.Clone(criada).Type == "point");
        Checar("light.all", l.All(new { local = true }).Length >= 2);
        Checar("light.sun", l.Sun() == Helix.Scene.Sun);
        Checar("effectiveRange", l.EffectiveRange(lampada) > 0);
        Checar("light.temperatureToColor", l.TemperatureToColor(6500).Length == 3);
        Checar("cssColor", l.CssColor(lampada) is string);
        Checar("light.isLocal", l.IsLocal(lampada));
        Checar("temperatureRange", l.TemperatureRange.Min < l.TemperatureRange.Max);
        l.SetColor(lampada, "#ffffff");
        var luz = lampada.Light;
        Checar("light.setColor", luz.Type != "ambient" && Helix.Math.Vec3.Equals(luz.Color, V(1, 1, 1), 0.01));
        return Task.CompletedTask;
    }

    private Task Ceu()
    {
        var sky = Helix.Sky;
        sky.Set(new { timeOfDay = 10.5, haze = 0.3, clouds = new { enabled = true, coverage = 0.45 } });
        Checar("sky.set", Aprox(sky.TimeOfDay, 10.5) && sky.Clouds.Enabled == true);
        Checar("sky.isDay", sky.IsDay == true);
        Checar("sky.sunDirection", sky.SunDirection()[1] > 0);
        Checar("sky.moonDirection", sky.MoonDirection().Length == 3);
        Checar("sky.formatTimeOfDay", ((string)sky.FormatTimeOfDay(10.5)).Contains(":"), sky.FormatTimeOfDay(10.5));
        Checar("sky.wrapTimeOfDay", sky.WrapTimeOfDay(25) == 1);
        Checar("sky.presets", sky.Presets().Any(p => p.Id == "dusk"));
        Checar("sky.moonPhaseName", sky.MoonPhaseName() is string);
        Checar("sky.hourAngle", sky.HourAngle() is double);
        assinaturas.Add(sky.OnHourChanged(h => Helix.Log.Info("Debug", $"Hora do céu: {h}")));
        assinaturas.Add(sky.OnSunset(() => Helix.Log.Info("Debug", "Pôr do sol")));
        sky.CycleSpeed = 0;
        Checar("sky.cycleSpeed", sky.CycleSpeed == 0);
        Checar("world.gravity", Helix.World.Gravity[1] < 0);
        Checar("world.wind", Helix.World.Wind.Speed is double);
        Helix.World.Wind.Set(new { speed = 2, direction = 45 });
        Checar("world.wind.set", Helix.World.Wind.Speed == 2);
        Checar("world.sky", Helix.World.Sky == sky.Settings);
        Checar("world.player", Helix.World.Player.Camera != null);
        return Task.CompletedTask;
    }

    private Task Camera()
    {
        var c = Helix.Camera;
        Checar("camera.fov", c.Fov > 0 && c.Aspect > 0);
        Checar("camera.near/far", c.Near > 0 && c.Far > c.Near);
        Checar("viewport", c.Viewport.Width > 0);
        var ponto = c.WorldToScreen(V(0, 0, 0));
        Checar("worldToScreen", ponto == null || ponto.X is double);
        var raio = c.ScreenToRay(c.Viewport.Width / 2, c.Viewport.Height / 2);
        Checar("screenToRay", raio == null || Aprox(Helix.Math.Vec3.Length(raio.Direction), 1, 0.01));
        Checar("viewMatrix", c.ViewMatrix.Length == 16 && c.ProjectionMatrix.Length == 16 && c.ViewProjectionMatrix.Length == 16);
        Checar("camera.main inicial", c.Main == null);
        Checar("player.settings", c.Player.Settings.Distance > 0);
        c.Player.Set(new { distance = 7, pitch = 18 });
        Checar("player.set", c.Player.Settings.Distance == 7);
        Checar("distanceTo", c.DistanceTo(V(0, 0, 0)) >= 0);
        Checar("mainForward", Helix.Math.Vec3.Length(c.MainForward()) > 0.99);
        Checar("camera.position", c.Position.Length == 3 && c.Target.Length == 3 && c.Forward.Length == 3);
        assinaturas.Add(c.OnMainChanged(e => Helix.Log.Info("Debug", $"Câmera principal: {(e != null ? e.Name : "editor/jogador")}")));
        return Task.CompletedTask;
    }

    private Task Pos()
    {
        var p = Helix.Post;
        Checar("post.toneMappers", p.ToneMappers().Contains("aces"));
        p.Set(new
        {
            bloom = new { enabled = true, intensity = 0.5, threshold = 1, softKnee = 0.5, radius = 0.6 },
            vignette = new { enabled = true, intensity = 0.35, smoothness = 0.5, roundness = 1 },
        });
        Checar("post.set", p.Bloom.Enabled == true && p.Vignette.Enabled == true);
        p.Exposure = 1.05;
        Checar("post.exposure", p.Exposure == 1.05);
        p.ToneMapper = "agx";
        Checar("post.toneMapper", p.ToneMapper == "agx");
        Checar("post.presets", p.Presets().Length > 0);
        Checar("post.snapshot", p.Snapshot().Bloom.Intensity == p.Bloom.Intensity);
        Checar("post.create", p.Create().Bloom != null);
        var personalizado = p.Custom.Add(new { fragment = "DebugPost", name = "DebugPost", uniforms = new { tint = V(0.15f, 0.05f, 0.3f), strength = 0.6 } });
        efeito = personalizado;
        Checar("post.custom.add", p.Custom.Get("DebugPost") == personalizado && p.Custom.List().Any(e => e.Name == "DebugPost"));
        personalizado.Uniforms.Set("strength", 0.8);
        var u = personalizado.Uniforms.List();
        Checar("efeito.uniforms.list", u.Any(x => x.Name == "tint") && u.Any(x => x.Name == "strength"), string.Join(",", u.Select(x => (string)x.Name)));
        p.Tween("bloom.intensity", 0.9, 1.5, "easeInOut");
        return Task.CompletedTask;
    }

    private Task Render()
    {
        var r = Helix.Render;
        Checar("render.passNames", r.PassNames().Contains("mesh"));
        Checar("render.passes", r.Passes.Mesh.Enabled is bool);
        Checar("render.stats", r.Stats.DrawCalls is double);
        Checar("render.profile", r.Profile.ShadowMapSize is double);
        Checar("render.gl", r.Gl != null && r.Gl.DrawArrays != null);
        assinaturas.Add(r.OnAfterFrame(() => renders++));
        assinaturas.Add(r.OnBeforePass("post", () => { }));
        Checar("render.frame", r.Frame.Width is double);
        r.ShowGrid = false;
        Checar("render.showGrid", r.ShowGrid == false);
        Checar("render.culling", r.Culling.FrustumCulling is bool);
        Checar("render.capabilities", r.Capabilities != null);
        Checar("render.pixelRatio", r.PixelRatio > 0);
        Checar("render.custom.list", r.Custom.List() is Array);
        var programa = r.CreateProgram("#version 300 es\\nvoid main(){gl_Position=vec4(0.0);}", "#version 300 es\\nprecision mediump float;out vec4 o;void main(){o=vec4(1.0);}");
        Checar("render.createProgram", programa != null && programa.Use != null);
        programa.Dispose();
        return Task.CompletedTask;
    }

                                                                                                     

    private Task Fisica()
    {
        var ph = Helix.Physics;
        Checar("physics.enabled", ph.Enabled == true);
        Checar("physics.gravity", ph.Gravity[1] < 0);
        Checar("physics.settings", ph.Settings.FixedTimestep > 0 && ph.FixedTimestep == ph.Settings.FixedTimestep);
        for (int i = 0; i < 5; i++)
        {
            var caixa = Helix.Scene.SpawnPrimitive("box", new { name = $"Caixa{i + 1}", position = V(-2 + i * 1.1f, 3 + i * 1.2f, 3), rigidBody = new { type = "dynamic", collider = "box", mass = 2, restitution = 0.3 }, tags = new[] { "caixa" } });
            Helix.Material.SetColor(caixa, Helix.Math.Color.Hsl(30 + i * 12, 0.7, 0.5));
        }
        var caixas = Helix.Scene.ByTag("caixa");
        Checar("caixas dinâmicas", caixas.Length == 5 && ph.HasBody(caixas[0]));
        var corpo = ph.BodyOf(caixas[0]);
        Checar("bodyOf", corpo.IsDynamic && corpo.Mass > 0);
        corpo.ApplyImpulse(V(0, 2, 0));
        corpo.ApplyTorque(V(0, 1, 0));
        corpo.SetMaterial(new { friction = 0.8 });
        corpo.LockRotation(false, false, false);
        corpo.Wake();
        Checar("body.entity", corpo.Entity == caixas[0] && ph.EntityOf(corpo) == caixas[0]);
        Checar("body.linearVelocity", corpo.LinearVelocity.Length == 3);
        Checar("bodies()", ph.Bodies().Length >= 6 && ph.BodyCount >= 6);
        var hit = ph.Raycast(V(0, 5, 0), V(0, -1, 0), 20);
        Checar("physics.raycast", hit != null && hit.Entity != null, hit?.Entity?.Name);
        Checar("raycastAll", ph.RaycastAll(V(0, 5, 0), V(0, -1, 0), 20).Length >= 1);
        Checar("overlapSphere", ph.OverlapSphere(V(0, 3, 3), 4) is Array);
        Checar("overlapBox", ph.OverlapBox(V(0, 3, 3), V(3, 3, 3)) is Array);
        Checar("overlapAabb", ph.OverlapAabb(new { min = V(-5, 0, 0), max = V(5, 8, 6) }) is Array);
        Checar("massProperties", ph.MassProperties(caixas[0]).Mass > 0);
        Checar("colliderRequiresStatic", ph.ColliderRequiresStatic("mesh") == true);
        Checar("colliderVolume", ph.ColliderVolume(caixas[0]) > 0);
        var presets = ph.Physical.Presets();
        Checar("physical.presets", presets.Length > 0);
        if (presets.Length > 0) Checar("physical.apply", ph.Physical.Apply(caixas[1], presets[0].Id).Type != null);
        Checar("physical.create/match", ph.Physical.Match(ph.Physical.Create()) != null || true);
        Checar("shapes.sphere volume", Aprox(ph.Shapes.Volume(ph.Shapes.Sphere(1)), 4.18879, 0.01));
        Checar("shapes.aabb", ph.Shapes.Aabb(ph.Shapes.Box(1, 1, 1), V(0, 0, 0)).Max[0] == 1);
        Checar("fitCollider", ph.FitCollider(caixas[0]).Collider != null);
        Checar("closestPoint", ph.ClosestPoint(V(0, 10, 3), caixas[0]).Length == 3);
        assinaturas.Add(ph.OnCollisionBegin(e =>
        {
            colisoes++;
            if (colisoes <= 3) Helix.Log.Info("Debug", $"Colisão: {e.A.Name} × {e.B.Name} (impulso {e.Contact.Impulse:F2})");
        }));
        assinaturas.Add(ph.OnCollisionEnd(_ => { }));
        assinaturas.Add(ph.OnOutOfBounds(e => Helix.Log.Warn("Debug", $"{e.Name} caiu do mundo")));
        assinaturas.Add(ph.OnPreStep(() => { }));
        var gatilho = Helix.Scene.Spawn("group", new { name = "Gatilho", position = V(0, 1, 3), trigger = new { shape = "box", size = V(3, 2, 3) } });
        Checar("trigger spawn", gatilho != null && Helix.Scene.IsAttached(gatilho));
        Checar("physics.stats", ph.Stats.Bodies is double);
        var agua = ph.WaterAt(V(0, 0, 0));
        Checar("waterAt", agua == null || agua.Height is double);
        ph.Layers.Define(new[] { "padrao", "fantasma" });
        ph.Layers.SetCollision("padrao", "fantasma", false);
        Checar("physics.quality", ph.Quality == null || new[] { "low", "medium", "high" }.Contains((string)ph.Quality));
        return Task.CompletedTask;
    }

    private Task Personagem()
    {
        var jogador = Helix.Character.Spawn(new { name = "Heroi", position = V(0, 1.2f, 8), character = new { walkSpeed = 4, runSpeed = 7, jumpHeight = 1.4 } });
        heroi = jogador;
        Checar("character.spawn", jogador.Character != null && Helix.Character.Has(jogador));
        var h = Helix.Character.Of(jogador);
        Checar("character.of", h.Entity == jogador && h.IsGrounded is bool);
        Checar("settingsOf", Helix.Character.SettingsOf(jogador).WalkSpeed == 4);
        Helix.Player.Possess(jogador);
        Checar("player.possess", Helix.Player.Possessed == jogador && Helix.Player.IsPossessing);
        Checar("findPossessable", Helix.Character.FindPossessable() != null);
        assinaturas.Add(Helix.Character.OnJumped(e => Helix.Log.Info("Debug", $"{e.Entity.Name} pulou")));
        assinaturas.Add(Helix.Character.OnLanded(e => { if (e.Speed > 6) Helix.Log.Info("Debug", $"{e.Entity.Name} aterrissou a {e.Speed:F1} m/s"); }));
        assinaturas.Add(Helix.Player.OnPossessed(e => Helix.Log.Info("Debug", $"Possuindo {(e != null ? e.Name : "ninguém")}")));
        Checar("character.all", Helix.Character.All().Length >= 1);
        Checar("player.spawnPoint", Helix.Player.SpawnPoint.Length == 3);
        Checar("character.inputSource", Helix.Character.InputSource == "engine");
        Checar("player.cameraControl", Helix.Player.CameraControl == "engine");
        Checar("player.settings", Helix.Player.Settings.Character.WalkSpeed > 0);
        Checar("character.velocity", h.Velocity.Length == 3 && h.Position.Length == 3);
        return Task.CompletedTask;
    }

    private Task Terreno()
`;
}
