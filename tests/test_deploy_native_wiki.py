import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location("release",Path(__file__).parents[1]/"tools/deploy_native_wiki.py")
release=importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
class WikiReleaseBoundaryTests(unittest.TestCase):
    def config(self):
        return {"services":{"rules-wiki":{"networks":{release.BACKEND:{},"rules-core-private-tunnel":{}},
                "environment":{"RulesCorePrivate__BaseUrl":f"http://{release.CORE}:8080"}}},
                "networks":{"rules-core-private-tunnel":{"name":"pair"}}}
    def test_accepts_reviewed_topology(self):
        self.assertEqual("pair",release.validate(self.config()))
    def test_rejects_ports_mounts_and_public_core_target(self):
        for key,value in [("ports",["8080:8080"]),("volumes",["data:/data"])]:
            config=self.config(); config["services"]["rules-wiki"][key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError): release.validate(config)
        config=self.config()
        config["services"]["rules-wiki"]["environment"]["RulesCorePrivate__BaseUrl"]=f"http://{release.PUBLIC}:8080"
        with self.assertRaises(RuntimeError): release.validate(config)
    def test_rejects_extra_service_or_network(self):
        config=self.config(); config["services"]["postgres"]={}
        with self.assertRaises(RuntimeError): release.validate(config)
        config=self.config(); config["services"]["rules-wiki"]["networks"]["database"]={}
        with self.assertRaises(RuntimeError): release.validate(config)
if __name__=="__main__": unittest.main()
